import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { loadActiveWorkout } from '../../database/workouts';
import { WorkoutScreen } from '../WorkoutScreen';

jest.mock('../../database/workouts', () => ({ loadActiveWorkout: jest.fn() }));
const database = {} as Database;
const mockedLoad = jest.mocked(loadActiveWorkout);

beforeEach(() => jest.clearAllMocks());

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

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  const mergedNavigation = { navigate: jest.fn(), setParams: jest.fn(), ...navigation };
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
