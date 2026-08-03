import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AccessibilityInfo } from 'react-native';

import { HomeScreen } from '../HomeScreen';
import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { getActiveWorkoutId, startWorkout } from '../../database/workouts';

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

function renderScreen(navigation: Record<string, jest.Mock> = {}, params?: { focusStartWorkout?: boolean }) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <HomeScreen navigation={{ navigate: jest.fn(), ...navigation } as never} route={{ params } as never} />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
