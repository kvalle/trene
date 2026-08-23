import { AccessibilityInfo, TextInput } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import {
  createExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
} from '../../database/exercises';
import type { Database } from '../../database/types';
import { createExerciseInWorkout } from '../../database/workouts';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { CreateExerciseScreen } from '../CreateExerciseScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));

jest.mock('../../database/exercises', () => ({
  ...jest.requireActual('../../database/exercises'),
  createExercise: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({ createExerciseInWorkout: jest.fn() }));

const database = {} as Database;
const mockedCreateExercise = jest.mocked(createExercise);
const mockedCreateExerciseInWorkout = jest.mocked(createExerciseInWorkout);

beforeEach(() => jest.clearAllMocks());

test('normalizes, persists, and opens detail after creation succeeds', async () => {
  const replace = jest.fn();
  mockedCreateExercise.mockResolvedValue(42);
  renderScreen({ replace });

  fireEvent.changeText(screen.getByLabelText('Navn'), '  Benk\tpress  ');
  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  await waitFor(() => expect(mockedCreateExercise).toHaveBeenCalledWith(database, 'Benk press', 'benk press'));
  expect(replace).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: 42 });
});

test('retains the draft and announces the same duplicate error from persistence', async () => {
  mockedCreateExercise.mockRejectedValue(new DuplicateExerciseNameError());
  renderScreen();

  fireEvent.changeText(screen.getByLabelText('Navn'), 'KNEBØY');
  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  expect(await screen.findByText(DUPLICATE_EXERCISE_NAME)).toBeOnTheScreen();
  expect(screen.getByDisplayValue('KNEBØY')).toHaveProp('accessibilityLabel', `Navn. Feil: ${DUPLICATE_EXERCISE_NAME}`);
});

test('cancels to its unchanged origin', () => {
  const goBack = jest.fn();
  renderScreen({ goBack }, 'mark');
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));
  expect(goBack).toHaveBeenCalledTimes(1);
  expect(mockedCreateExercise).not.toHaveBeenCalled();
});

test('creates and selects directly when opened from the workout picker', async () => {
  const popTo = jest.fn();
  mockedCreateExerciseInWorkout.mockResolvedValue(43);
  renderScreen({ popTo }, 'press', { origin: 'workout', workoutId: 9 });

  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  await waitFor(() => expect(mockedCreateExerciseInWorkout)
    .toHaveBeenCalledWith(database, 9, 'press', 'press'));
  expect(popTo).toHaveBeenCalledWith('Workout', { focusExerciseId: 43 });
});

test('autofocuses the name field on mount', () => {
  const focusSpy = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});
  renderScreen();
  expect(focusSpy).toHaveBeenCalled();
  focusSpy.mockRestore();
});

test('submits via keyboard return key', async () => {
  const replace = jest.fn();
  mockedCreateExercise.mockResolvedValue(42);
  renderScreen({ replace });

  fireEvent.changeText(screen.getByLabelText('Navn'), 'Knebøy');
  fireEvent(screen.getByTestId('exercise-name-input'), 'submitEditing');

  await waitFor(() => expect(mockedCreateExercise).toHaveBeenCalledWith(database, 'Knebøy', 'knebøy'));
  expect(replace).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: 42 });
});

test('shows generic persistence failure, retains draft and re-enables form', async () => {
  const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  mockedCreateExercise.mockRejectedValue(new Error('db down'));
  renderScreen();

  fireEvent.changeText(screen.getByLabelText('Navn'), 'Markløft');
  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  expect(await screen.findByText('Kunne ikke opprette øvelsen. Prøv igjen.')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Markløft')).toBeOnTheScreen();
  expect(screen.getByTestId('exercise-name-input')).toBeEnabled();
  expect(screen.getByTestId('create-exercise-submit')).toBeEnabled();
  expect(announceSpy).toHaveBeenCalledWith('Kunne ikke opprette øvelsen. Prøv igjen.');
  announceSpy.mockRestore();
});

test('validates empty name, announces error and keeps focus contract', async () => {
  const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  expect(await screen.findByText('Skriv inn et navn')).toBeOnTheScreen();
  expect(announceSpy).toHaveBeenCalledWith('Skriv inn et navn');
  expect(mockedCreateExercise).not.toHaveBeenCalled();
  announceSpy.mockRestore();
});

test('disables field and both actions while saving and blocks navigation', async () => {
  const { usePreventRemove } = require('@react-navigation/native') as { usePreventRemove: jest.Mock };
  let resolveSave!: (value: number) => void;
  mockedCreateExercise.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
  renderScreen();
  fireEvent.changeText(screen.getByLabelText('Navn'), 'Benkpress');
  fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));

  expect(await screen.findByText('Lagrer…')).toBeOnTheScreen();
  expect(screen.getByTestId('exercise-name-input')).toBeDisabled();
  expect(screen.getByTestId('create-exercise-submit')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
  expect(usePreventRemove).toHaveBeenCalledWith(true, expect.any(Function));
  // fulfill and verify re-enabled via navigation mock (replace) rather than stuck
  const replace = jest.fn();
  // re-render with replace to observe navigation after resolve
  // Instead resolve promise and check busy cleared
  // Use separate render to avoid stale navigation mock: just resolve and wait for disabled cleared
  resolveSave(99);
  await waitFor(() => expect(screen.queryByText('Lagrer…')).not.toBeOnTheScreen());
});

test('preserves initialName as first draft', () => {
  renderScreen({}, 'Eksisterende');
  expect(screen.getByDisplayValue('Eksisterende')).toBeOnTheScreen();
});

function renderScreen(
  navigation: Record<string, jest.Mock> = {},
  initialName?: string,
  extraParams: Record<string, unknown> = {},
) {
  return render(
    <AppThemeProvider>
      <DatabaseProvider database={database}>
        <NavigationContainer>
          <CreateExerciseScreen
            navigation={{ replace: jest.fn(), goBack: jest.fn(), ...navigation } as never}
            route={{ params: initialName === undefined && Object.keys(extraParams).length === 0
              ? undefined : { initialName, ...extraParams } } as never}
          />
        </NavigationContainer>
      </DatabaseProvider>
    </AppThemeProvider>,
  );
}
