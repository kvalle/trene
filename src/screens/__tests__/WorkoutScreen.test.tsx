import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Modal } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { cancelActiveWorkout, loadActiveWorkout } from '../../database/workouts';
import { WorkoutScreen } from '../WorkoutScreen';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn(() => 12),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({ cancelActiveWorkout: jest.fn(), loadActiveWorkout: jest.fn() }));
const database = {} as Database;
const mockedLoad = jest.mocked(loadActiveWorkout);
const mockedCancel = jest.mocked(cancelActiveWorkout);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

test('shows an active workout and opens its cancellable exercise picker', async () => {
  const navigate = jest.fn();
  const setParams = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  renderScreen({ navigate, setParams });

  expect(await screen.findByText('Ingen øvelser lagt til ennå')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ferdig' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Legg til øvelse' }));
  expect(setParams).toHaveBeenCalledWith({ focusAddExercise: true });
  expect(navigate).toHaveBeenCalledWith('ExercisePicker', { workoutId: 3 });
});

test('opens the selected exercise with an editable planned set', async () => {
  mockedLoad.mockResolvedValue({
    id: 3,
    exercises: [{
      id: 4, exerciseId: 5, name: 'Knebøy', position: 0,
      sets: [{ id: 6, loadKg: null, repetitions: null, confirmedAt: null }],
    }],
  });
  renderScreen();

  expect(await screen.findByText('Knebøy')).toBeOnTheScreen();
  expect(screen.getByText('Planlagt sett')).toBeOnTheScreen();
  expect(screen.getByLabelText('Belastning for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByLabelText('Repetisjoner for Knebøy')).not.toHaveProp('editable', false);
  expect(screen.getByRole('button', { name: 'Legg til sett' })).toBeOnTheScreen();
});

test.each([
  ['empty', []],
  ['populated', [{ id: 4, exerciseId: 5, name: 'Knebøy', position: 0, sets: [] }]],
])('confirms cancellation of an %s workout before returning Home', async (_, exercises) => {
  const popTo = jest.fn();
  mockedLoad.mockResolvedValue({ id: 3, exercises });
  mockedCancel.mockResolvedValue();
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(screen.getByRole('header', { name: 'Avbryt økten?' })).toBeOnTheScreen();
  expect(screen.getByText('Økten slettes permanent og vises ikke i historikken.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt økten' }));

  await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith(database, 3));
  expect(popTo).toHaveBeenCalledWith('Home', { focusStartWorkout: true });
});

test('closes the dialog without deleting and restores focus to Avbryt', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  expect(UNSAFE_getByType(Modal).props.onShow).toEqual(expect.any(Function));
  fireEvent.press(screen.getByRole('button', { name: 'Behold økten' }));

  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeOnTheScreen();
  expect(focus).toHaveBeenCalled();
});

test('platform Back closes the confirmation dialog first', async () => {
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  const { UNSAFE_getByType } = renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent(UNSAFE_getByType(Modal), 'requestClose');

  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(mockedCancel).not.toHaveBeenCalled();
});

test('preserves the workout, announces retry, and does not navigate when cancellation fails', async () => {
  const popTo = jest.fn();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedLoad.mockResolvedValue({ id: 3, exercises: [] });
  mockedCancel.mockRejectedValue(new Error('write failed'));
  renderScreen({ popTo });

  fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt økten' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke avbryte økten');
  expect(screen.queryByText('Avbryt økten?')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('Kunne ikke avbryte økten. Prøv igjen.');
  expect(focus).toHaveBeenCalled();
  expect(popTo).not.toHaveBeenCalled();
});

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  const mergedNavigation = { navigate: jest.fn(), popTo: jest.fn(), setParams: jest.fn(), ...navigation };
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <WorkoutScreen
          navigation={mergedNavigation as never}
          route={{ params: undefined } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
