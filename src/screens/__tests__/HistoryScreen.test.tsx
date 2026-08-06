import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { getActiveWorkoutId, listCompletedWorkouts, startWorkout } from '../../database/workouts';
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

const database = {} as Database;
const mockedActiveWorkout = jest.mocked(getActiveWorkoutId);
const mockedList = jest.mocked(listCompletedWorkouts);
const mockedStart = jest.mocked(startWorkout);

beforeEach(() => {
  jest.clearAllMocks();
  mockedActiveWorkout.mockResolvedValue(null);
});

test('shows accessible whole rows with completion time and saved exercise count', async () => {
  const navigate = jest.fn();
  mockedList.mockResolvedValue([
    { id: 3, completedAt: '2026-08-05T10:30:00Z', exerciseCount: 1 },
    { id: 4, completedAt: '2026-08-04T10:30:00Z', exerciseCount: 2 },
  ]);
  renderScreen({ navigate });

  await screen.findByText(/5. august 2026/);
  const rows = [
    screen.getByLabelText(/5. august 2026.*1 øvelse/),
    screen.getByLabelText(/4. august 2026.*2 øvelser/),
  ];
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveProp('accessibilityRole', 'button');
  expect(rows[0]).toHaveProp('accessibilityHint', 'Åpner den fullførte økten');
  expect(rows[0].props.accessibilityLabel).toMatch(/5. august 2026.*1 øvelse/);
  expect(rows[1].props.accessibilityLabel).toMatch(/4. august 2026.*2 øvelser/);
  fireEvent.press(rows[0]);
  expect(navigate).toHaveBeenCalledWith('CompletedWorkout', { workoutId: 3 });
  expect(mockedActiveWorkout).not.toHaveBeenCalled();
});

test.each([
  [null, 'Start økt'],
  [7, 'Fortsett økt'],
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

  fireEvent.press(await screen.findByRole('button', { name: 'Start økt' }));
  expect(await screen.findByRole('button', { name: 'Starter økt' })).toBeDisabled();
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => finishStart(8));
  expect(navigate).toHaveBeenCalledWith('Workout');
});

test('blocks navigation again for each new workout start', async () => {
  let preventRemove: ((event: { data: { action: object } }) => void) | undefined;
  jest.mocked(usePreventRemove).mockImplementation((_, callback) => { preventRemove = callback as typeof preventRemove; });
  const dispatch = jest.fn();
  const navigate = jest.fn();
  mockedList.mockResolvedValue([]);
  mockedStart.mockResolvedValueOnce(8).mockImplementationOnce(() => new Promise(() => undefined));
  const view = renderScreen({ dispatch, navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'Start økt' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Workout'));
  view.rerender(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <HistoryScreen
          navigation={{ dispatch, navigate } as never}
          route={{} as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Start økt' }));
  act(() => preventRemove?.({ data: { action: {} } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('retries read failures without presenting an empty history', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedList.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([]);
  renderScreen();

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke laste inn tidligere økter.');
  expect(focus).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Start økt' })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  expect(await screen.findByRole('button', { name: 'Start økt' })).toBeOnTheScreen();
  expect(mockedList).toHaveBeenCalledTimes(2);
});

test('keeps the empty state available when starting a workout fails', async () => {
  mockedList.mockResolvedValue([]);
  mockedStart.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Start økt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke starte økten.');
  expect(screen.getByRole('button', { name: 'Start økt' })).toBeEnabled();
});

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <HistoryScreen
          navigation={{ dispatch: jest.fn(), navigate: jest.fn(), ...navigation } as never}
          route={{} as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
