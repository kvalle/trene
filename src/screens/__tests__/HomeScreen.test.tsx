import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { HomeScreen } from '../HomeScreen';
import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { getActiveWorkoutId, startWorkout } from '../../database/workouts';
import { WorkoutDraftProvider } from '../../workoutDrafts';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn(() => 12),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({
  getActiveWorkoutId: jest.fn(),
  startWorkout: jest.fn(),
}));

const database = {} as Database;
const mockedGetActiveWorkoutId = jest.mocked(getActiveWorkoutId);
const mockedStartWorkout = jest.mocked(startWorkout);

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetActiveWorkoutId.mockResolvedValue(null);
});

test('shows the empty Home actions and opens them hierarchically', async () => {
  const navigate = jest.fn();
  renderScreen({ navigate });

  expect(await screen.findByRole('button', { name: 'Start økt' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tidligere økter' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Øvelser' })).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Tidligere økter' }));
  expect(navigate).toHaveBeenCalledWith('History');
});

test('persists the workout before opening it and resumes an existing workout', async () => {
  const navigate = jest.fn();
  let finishStart: (id: number) => void = () => undefined;
  mockedStartWorkout.mockImplementation(() => new Promise((resolve) => { finishStart = resolve; }));
  renderScreen({ navigate });

  fireEvent.press(await screen.findByRole('button', { name: 'Start økt' }));
  expect(await screen.findByRole('button', { name: 'Starter økt' })).toBeDisabled();
  await act(async () => finishStart(7));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Workout'));

  mockedGetActiveWorkoutId.mockResolvedValue(7);
  renderScreen();
  expect(await screen.findByRole('button', { name: 'Fortsett økt' })).toBeOnTheScreen();
});

test('focuses Start økt after a cancelled workout', async () => {
  const setParams = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  renderScreen({ setParams }, { focusStartWorkout: true });

  expect(await screen.findByRole('button', { name: 'Start økt' })).toBeOnTheScreen();
  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(setParams).toHaveBeenCalledWith({ focusStartWorkout: undefined });
});

test('marks an active workout when a set edit has not been saved', async () => {
  mockedGetActiveWorkoutId.mockResolvedValue(7);
  renderScreen({}, undefined, true);

  expect(await screen.findByRole('alert')).toHaveTextContent('Økten har endringer som ikke er lagret');
});

test('refreshes the active workout from SQLite on foreground', async () => {
  let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  mockedGetActiveWorkoutId.mockResolvedValueOnce(null).mockResolvedValueOnce(7);
  renderScreen();
  expect(await screen.findByRole('button', { name: 'Start økt' })).toBeOnTheScreen();

  act(() => onAppStateChange?.('active'));

  expect(await screen.findByRole('button', { name: 'Fortsett økt' })).toBeOnTheScreen();
  expect(mockedGetActiveWorkoutId).toHaveBeenCalledTimes(2);
});

test('ignores save errors belonging to another workout', async () => {
  mockedGetActiveWorkoutId.mockResolvedValue(7);
  renderScreen({}, undefined, true, 8);

  expect(await screen.findByRole('button', { name: 'Fortsett økt' })).toBeOnTheScreen();
  expect(screen.queryByText('Økten har endringer som ikke er lagret')).not.toBeOnTheScreen();
});

function renderScreen(
  navigation: Record<string, jest.Mock> = {},
  params?: { focusStartWorkout?: boolean },
  failedDraft = false,
  draftWorkoutId = 7,
) {
  return render(
    <DatabaseProvider database={database}>
      <WorkoutDraftProvider initialDrafts={failedDraft ? {
        6: { workoutId: draftWorkoutId, load: '80', repetitions: '5', unsaved: true },
      } : undefined}>
        <NavigationContainer>
          <HomeScreen navigation={{ navigate: jest.fn(), ...navigation } as never} route={{ params } as never} />
        </NavigationContainer>
      </WorkoutDraftProvider>
    </DatabaseProvider>,
  );
}
