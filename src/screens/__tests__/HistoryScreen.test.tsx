import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccessibilityInfo, Text } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { listTrainingContextChoices, listTrainingContexts } from '../../database/trainingContexts';
import { getActiveWorkoutId, listCompletedWorkouts, startWorkout } from '../../database/workouts';
import { historyFilterPreferenceStore } from '../../preferences/historyFilterPreference';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { HistoryScreen } from '../HistoryScreen';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({
  getActiveWorkoutId: jest.fn(),
  listCompletedWorkouts: jest.fn(),
  startWorkout: jest.fn(),
}));
jest.mock('../../database/trainingContexts', () => ({
  ...jest.requireActual('../../database/trainingContexts'),
  listTrainingContextChoices: jest.fn(),
  listTrainingContexts: jest.fn(),
}));
jest.mock('../../preferences/historyFilterPreference', () => ({
  historyFilterPreferenceStore: { read: jest.fn(), write: jest.fn() },
}));

const database = {} as Database;
const mockedActiveWorkout = jest.mocked(getActiveWorkoutId);
const mockedList = jest.mocked(listCompletedWorkouts);
const mockedStart = jest.mocked(startWorkout);
const mockedChoices = jest.mocked(listTrainingContextChoices);
const mockedContexts = jest.mocked(listTrainingContexts);
const mockedFilterRead = jest.mocked(historyFilterPreferenceStore.read);
const mockedFilterWrite = jest.mocked(historyFilterPreferenceStore.write);

beforeEach(() => {
  jest.clearAllMocks();
  mockedActiveWorkout.mockResolvedValue(null);
  mockedChoices.mockResolvedValue([{ id: 1, name: 'Standard', archived: false, lastUsedAt: null }]);
  mockedContexts.mockResolvedValue([{ id: 1, name: 'Standard', archived: false, workoutCount: 1 }]);
  mockedFilterRead.mockResolvedValue(new Set());
  mockedFilterWrite.mockResolvedValue();
});

test('announces that completed workouts are loading', () => {
  mockedList.mockImplementation(() => new Promise(() => undefined));
  renderScreen();

  expect(screen.getByLabelText('Laster tidligere treninger')).toBeOnTheScreen();
});

const TODAY = new Date(2026, 10, 8, 12, 0); // Sunday 8 November 2026
const local = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).toISOString();

function useClock() {
  jest.useFakeTimers({ now: TODAY, doNotFake: [
    'nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
    'hrtime', 'performance',
  ] });
}

afterEach(() => jest.useRealTimers());

test('shows one card per month from the current month back to the first workout, with summaries', async () => {
  useClock();
  mockedList.mockResolvedValue([
    { id: 3, completedAt: local(9, 20), exerciseCount: 1, trainingContextId: 1 },
    { id: 2, completedAt: local(9, 10), exerciseCount: 2, trainingContextId: 1 },
    { id: 1, completedAt: local(8, 25), exerciseCount: 2, trainingContextId: 1 },
  ]);
  renderScreen();

  const headers = await screen.findAllByRole('button', { name: /^\w+ 2026, / });
  expect(headers.map((header) => header.props.accessibilityLabel)).toEqual([
    'November 2026, Ingen treninger så langt.',
    'Oktober 2026, Ingen treninger.',
    'September 2026, 2 treninger. I snitt 0,5 per uke.',
    'August 2026, 1 trening. I snitt 1,0 per uke.',
  ]);
  expect(screen.getByText('2 treninger. I snitt 0,5 per uke.')).toBeOnTheScreen();
  expect(headers.map((header) => header.props.accessibilityState.expanded)).toEqual([false, false, true, false]);
  expect(screen.getByTestId('history-calendar-2026-09')).toBeOnTheScreen();
  expect(screen.queryByTestId('history-calendar-2026-08')).not.toBeOnTheScreen();
});

test('expands and collapses months independently', async () => {
  useClock();
  mockedList.mockResolvedValue([
    { id: 2, completedAt: local(11, 2), exerciseCount: 1, trainingContextId: 1 },
    { id: 1, completedAt: local(10, 5), exerciseCount: 1, trainingContextId: 1 },
  ]);
  renderScreen();

  const october = await screen.findByRole('button', { name: /^Oktober 2026/ });
  const november = screen.getByRole('button', { name: /^November 2026/ });
  expect(november).toHaveProp('accessibilityState', { expanded: true });
  fireEvent.press(october);
  expect(screen.getByRole('button', { name: /^Oktober 2026/ })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: /^November 2026/ })).toHaveProp('accessibilityState', { expanded: true });
  fireEvent.press(screen.getByRole('button', { name: /^November 2026/ }));
  expect(screen.getByRole('button', { name: /^November 2026/ })).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.queryByTestId('history-calendar-2026-11')).not.toBeOnTheScreen();
  expect(screen.getByTestId('history-calendar-2026-10')).toBeOnTheScreen();
});

test('opens the completed workout from its highlighted day', async () => {
  useClock();
  const navigate = jest.fn();
  mockedList.mockResolvedValue([
    { id: 5, completedAt: local(11, 3, 18), exerciseCount: 1, trainingContextId: 1 },
    { id: 4, completedAt: local(11, 2), exerciseCount: 2, trainingContextId: 1 },
  ]);
  renderScreen({ navigate });

  const day = await screen.findByRole('button', { name: 'tirsdag 3. november 2026, 1 trening' });
  expect(screen.getByLabelText('onsdag 4. november 2026')).not.toHaveProp('accessibilityRole', 'button');
  fireEvent.press(day);
  expect(navigate).toHaveBeenCalledWith('CompletedWorkout', { workoutId: 5 });
  expect(mockedActiveWorkout).not.toHaveBeenCalled();
});

test('lets the user choose between several workouts on the same day', async () => {
  useClock();
  const navigate = jest.fn();
  mockedList.mockResolvedValue([
    { id: 7, completedAt: local(11, 3, 18), exerciseCount: 1, trainingContextId: 1 },
    { id: 6, completedAt: local(11, 3, 7), exerciseCount: 3, trainingContextId: 1 },
  ]);
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'tirsdag 3. november 2026, 2 treninger' }));
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole('header', { name: 'Tirsdag 3. november 2026' })).toBeOnTheScreen();
  const rows = screen.getAllByRole('button', { name: /^Kl\. / });
  expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Kl. 07:00, 3 øvelser', 'Kl. 18:00, 1 øvelse']);

  fireEvent.press(rows[1]);
  expect(navigate).toHaveBeenCalledWith('CompletedWorkout', { workoutId: 7 });
  expect(screen.queryByTestId('history-day-choice')).not.toBeOnTheScreen();
});

test('dismisses the workout choice without navigating', async () => {
  useClock();
  const navigate = jest.fn();
  mockedList.mockResolvedValue([
    { id: 7, completedAt: local(11, 3, 18), exerciseCount: 1, trainingContextId: 1 },
    { id: 6, completedAt: local(11, 3, 7), exerciseCount: 3, trainingContextId: 1 },
  ]);
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'tirsdag 3. november 2026, 2 treninger' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));
  expect(screen.queryByTestId('history-day-choice')).not.toBeOnTheScreen();
  expect(navigate).not.toHaveBeenCalled();
});

test('keeps expanded months after returning from a completed workout', async () => {
  useClock();
  const workouts = [
    { id: 2, completedAt: local(11, 2), exerciseCount: 1, trainingContextId: 1 },
    { id: 1, completedAt: local(10, 5), exerciseCount: 1, trainingContextId: 1 },
  ];
  mockedList.mockResolvedValue(workouts);
  const Stack = createNativeStackNavigator();
  render(
    <DatabaseProvider database={database}>
      <AppThemeProvider scheme="light">
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="History" component={HistoryScreen as never} />
            <Stack.Screen name="CompletedWorkout">
              {({ navigation }) => <Text onPress={() => navigation.goBack()}>Tilbake</Text>}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </AppThemeProvider>
    </DatabaseProvider>,
  );

  fireEvent.press(await screen.findByRole('button', { name: /^Oktober 2026/ }));
  fireEvent.press(screen.getByRole('button', { name: /^mandag 5. oktober 2026/ }));
  fireEvent.press(await screen.findByText('Tilbake'));
  await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));

  expect(screen.getByRole('button', { name: /^Oktober 2026/ })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: /^November 2026/ })).toHaveProp('accessibilityState', { expanded: true });
});

test.each([
  [null, 'Start trening'],
  [7, 'Fortsett trening'],
] as const)('offers the durable empty action for active workout %s', async (activeWorkoutId, label) => {
  const navigate = jest.fn();
  mockedList.mockResolvedValue([]);
  mockedActiveWorkout.mockResolvedValue(activeWorkoutId);
  mockedStart.mockResolvedValue(8);
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: label }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Workout'));
  expect(mockedStart).toHaveBeenCalledTimes(activeWorkoutId === null ? 1 : 0);
});

test('persists a new workout before leaving the empty state', async () => {
  let finishStart: (id: number) => void = () => undefined;
  const navigate = jest.fn();
  mockedList.mockResolvedValue([]);
  mockedStart.mockImplementation(() => new Promise((resolve) => { finishStart = resolve; }));
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'Start trening' }));
  expect(await screen.findByRole('button', { name: 'Starter trening' })).toBeDisabled();
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => finishStart(8));
  expect(navigate).toHaveBeenCalledWith('Workout');
});

test('asks for a kontekst from the empty state when several are active', async () => {
  const navigate = jest.fn();
  mockedList.mockResolvedValue([]);
  mockedChoices.mockResolvedValue([
    { id: 1, name: 'Standard', archived: false, lastUsedAt: null },
    { id: 2, name: 'Fysio', archived: false, lastUsedAt: null },
  ]);
  mockedStart.mockResolvedValue(8);
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'Start trening' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Fysio' }));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Workout'));
  expect(mockedStart).toHaveBeenCalledWith(database, 2);
});

test('blocks navigation again for each new workout start', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  const dispatch = jest.fn();
  const navigate = jest.fn();
  mockedList.mockResolvedValue([]);
  mockedStart.mockResolvedValueOnce(8).mockImplementationOnce(() => new Promise(() => undefined));
  const view = renderScreen({ dispatch, navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'Start trening' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Workout'));
  view.rerender(
    <DatabaseProvider database={database}>
      <AppThemeProvider scheme="light">
        <NavigationContainer>
          <HistoryScreen
            navigation={{ dispatch, navigate } as never}
            route={{} as never}
          />
        </NavigationContainer>
      </AppThemeProvider>
    </DatabaseProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Start trening' }));
  act(() => preventRemove?.({ data: { action: {} } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('retries read failures without presenting an empty history', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedList.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([]);
  renderScreen();

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke laste inn tidligere treninger.');
  expect(focus).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Start trening' })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  expect(await screen.findByRole('button', { name: 'Start trening' })).toBeOnTheScreen();
  expect(mockedList).toHaveBeenCalledTimes(2);
});

test('keeps the empty state available when starting a workout fails', async () => {
  mockedList.mockResolvedValue([]);
  mockedStart.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Start trening' }));
  expect(await screen.findByText('Kunne ikke starte treningen.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Start trening' })).toBeEnabled();
});

test('focuses and expands the month of the requested remaining workout after reloading history', async () => {
  useClock();
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedList.mockResolvedValue([
    { id: 5, completedAt: local(10, 4), exerciseCount: 2, trainingContextId: 1 },
    { id: 4, completedAt: local(8, 4), exerciseCount: 2, trainingContextId: 1 },
  ]);
  renderScreen({ setParams }, { focusWorkoutId: 4 });

  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: /^August 2026/ })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: /^Oktober 2026/ })).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByRole('button', { name: 'tirsdag 4. august 2026, 1 trening' })).toBeOnTheScreen();
  expect(setParams).toHaveBeenCalledWith({ focusWorkoutId: undefined, focusEmptyAction: undefined });
});

test.each([null, 7] as const)('focuses the empty action after deleting the last workout with active workout %s', async (activeWorkoutId) => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedList.mockResolvedValue([]);
  mockedActiveWorkout.mockResolvedValue(activeWorkoutId);
  renderScreen({}, { focusEmptyAction: true });

  await screen.findByRole('button', { name: activeWorkoutId === null ? 'Start trening' : 'Fortsett trening' });
  expect(focus).toHaveBeenCalled();
});

describe('kontekst filter', () => {
  const contexts = [
    { id: 2, name: 'Fysio', archived: true, workoutCount: 1 },
    { id: 1, name: 'Standard', archived: false, workoutCount: 2 },
    { id: 3, name: 'Treningssenter', archived: false, workoutCount: 1 },
    { id: 4, name: 'Uten historikk', archived: false, workoutCount: 0 },
  ];
  const workouts = [
    { id: 4, completedAt: local(11, 3), exerciseCount: 1, trainingContextId: 3 },
    { id: 3, completedAt: local(11, 2), exerciseCount: 1, trainingContextId: 1 },
    { id: 2, completedAt: local(11, 1), exerciseCount: 1, trainingContextId: 2 },
    { id: 1, completedAt: local(10, 5), exerciseCount: 1, trainingContextId: 1 },
  ];
  const november = () => screen.getByTestId('history-month-2026-11');

  beforeEach(() => {
    useClock();
    mockedList.mockResolvedValue(workouts);
    mockedContexts.mockResolvedValue(contexts);
  });

  test('is hidden and shows every treningsøkt when fewer than two kontekster have history', async () => {
    mockedContexts.mockResolvedValue([contexts[1], { ...contexts[0], workoutCount: 0 }]);
    mockedFilterRead.mockResolvedValue(new Set([1]));
    renderScreen();

    expect(await screen.findByRole('button', { name: /^November 2026, 3 treninger/ })).toBeOnTheScreen();
    expect(screen.queryByTestId('history-filter')).toBeNull();
  });

  test('lists kontekster with history, all selected, collapsed by default', async () => {
    renderScreen();

    const header = await screen.findByRole('button', { name: 'Filter, Viser alle kontekster' });
    expect(header).toHaveProp('accessibilityState', { expanded: false });
    expect(screen.getByText('Viser alle kontekster')).toBeOnTheScreen();
    fireEvent.press(header);

    expect(screen.getByRole('checkbox', { name: 'Fysio, Arkivert, 1' })).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(screen.getByRole('checkbox', { name: 'Standard, 2' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Treningssenter, 1' })).toBeOnTheScreen();
    expect(screen.queryByText('Uten historikk')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vis alle' })).toBeNull();
  });

  test('filters months and calendars, locks the last row, persists hidden ids and shows all again', async () => {
    renderScreen();
    fireEvent.press(await screen.findByRole('button', { name: 'Filter, Viser alle kontekster' }));
    expect(screen.getByRole('button', { name: /^November 2026, 3 treninger/ })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('checkbox', { name: 'Standard, 2' }));
    expect(mockedFilterWrite).toHaveBeenLastCalledWith(new Set([1]));
    expect(screen.getByRole('button', { name: 'Filter, Viser kun Fysio og Treningssenter' })).toBeOnTheScreen();
    expect(november()).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^November 2026, 2 treninger/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /mandag 2\. november 2026, 1 trening/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Oktober 2026/ })).toBeNull();

    fireEvent.press(screen.getByRole('checkbox', { name: 'Fysio, Arkivert, 1' }));
    expect(screen.getByRole('button', { name: 'Filter, Viser kun Treningssenter' })).toBeOnTheScreen();
    const last = screen.getByRole('checkbox', { name: 'Treningssenter, 1' });
    expect(last).toHaveProp('accessibilityState', { checked: true, disabled: true });
    fireEvent.press(last);
    expect(mockedFilterWrite).toHaveBeenLastCalledWith(new Set([1, 2]));
    expect(screen.getByRole('button', { name: /^November 2026, 1 trening/ })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Vis alle' }));
    expect(mockedFilterWrite).toHaveBeenLastCalledWith(new Set());
    expect(screen.getByRole('button', { name: 'Filter, Viser alle kontekster' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Vis alle' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Oktober 2026/ })).toBeOnTheScreen();
  });

  test('restores the stored selection, ignoring unknown ids and showing new kontekster', async () => {
    mockedFilterRead.mockResolvedValue(new Set([1, 99]));
    renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Filter, Viser kun Fysio og Treningssenter' }));
    expect(screen.getByRole('checkbox', { name: 'Standard, 2' })).toHaveProp('accessibilityState', { checked: false, disabled: false });
    expect(screen.getByRole('button', { name: /^November 2026, 2 treninger/ })).toBeOnTheScreen();
  });

  test('summarises a long selection as a count', async () => {
    const long = [
      { id: 1, name: 'Styrketrening hjemme', archived: false, workoutCount: 2 },
      { id: 2, name: 'Fysioterapi', archived: false, workoutCount: 1 },
      { id: 3, name: 'Treningssenteret', archived: false, workoutCount: 1 },
    ];
    mockedContexts.mockResolvedValue(long);
    mockedFilterRead.mockResolvedValue(new Set([2]));
    renderScreen();

    expect(await screen.findByRole('button', { name: 'Filter, Viser 2 valgte kontekster' })).toBeOnTheScreen();
  });
});

function renderScreen(navigation: Record<string, jest.Mock> = {}, params?: { focusWorkoutId?: number; focusEmptyAction?: boolean }) {
  return render(
    <DatabaseProvider database={database}>
      <AppThemeProvider scheme="light">
        <NavigationContainer>
          <HistoryScreen
            navigation={{ dispatch: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), ...navigation } as never}
            route={{ params } as never}
          />
        </NavigationContainer>
      </AppThemeProvider>
    </DatabaseProvider>,
  );
}
