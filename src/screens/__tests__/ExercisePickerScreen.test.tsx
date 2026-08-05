import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import type { Database } from '../../database/types';
import { addExerciseToWorkout, countExercises, listAvailableExercises } from '../../database/workouts';
import { ExercisePickerScreen } from '../ExercisePickerScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'), usePreventRemove: jest.fn(),
}));
jest.mock('../../database/workouts', () => ({
  addExerciseToWorkout: jest.fn(), listAvailableExercises: jest.fn(),
  countExercises: jest.fn(),
}));
const database = {} as Database;
const mockedList = jest.mocked(listAvailableExercises);
const mockedAdd = jest.mocked(addExerciseToWorkout);
const mockedCount = jest.mocked(countExercises);

beforeEach(() => {
  jest.clearAllMocks();
  mockedCount.mockResolvedValue(0);
});

test('offers first creation on an empty installation', async () => {
  mockedList.mockResolvedValue([]);
  renderScreen();
  expect(await screen.findByRole('button', { name: 'Opprett første øvelse' })).toBeOnTheScreen();
});

test('filters deterministically, pre-fills no-match creation, and selects after storage', async () => {
  const popTo = jest.fn();
  const navigate = jest.fn();
  mockedCount.mockResolvedValue(2);
  mockedList.mockResolvedValue([{ id: 1, name: 'Knebøy' }, { id: 2, name: 'Markløft' }]);
  mockedAdd.mockResolvedValue();
  renderScreen({ navigate, popTo });

  fireEvent.changeText(await screen.findByLabelText('Søk i øvelser'), 'press');
  expect(screen.getByText('Ingen øvelser funnet')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Opprett «press»' }));
  expect(navigate).toHaveBeenCalledWith('CreateExercise', {
    initialName: 'press', origin: 'workout', workoutId: 9,
  });

  fireEvent.changeText(screen.getByLabelText('Søk i øvelser'), 'mark');
  fireEvent.press(screen.getByRole('button', { name: 'Markløft' }));
  await waitFor(() => expect(mockedAdd).toHaveBeenCalledWith(database, 9, 2));
  expect(popTo).toHaveBeenLastCalledWith('Workout', { focusExerciseId: 2 });
});

test('distinguishes the all-added state and cancellation changes no membership', async () => {
  const popTo = jest.fn();
  mockedCount.mockResolvedValue(2);
  mockedList.mockResolvedValue([]);
  renderScreen({ popTo });
  expect(await screen.findByText('Alle eksisterende øvelser er lagt til')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));
  expect(popTo).toHaveBeenCalledWith('Workout', { focusAddExercise: true });
  expect(mockedAdd).not.toHaveBeenCalled();
});

test('invokes create and cancel actions from the exercise list', async () => {
  const navigate = jest.fn();
  const popTo = jest.fn();
  mockedCount.mockResolvedValue(1);
  mockedList.mockResolvedValue([{ id: 1, name: 'Knebøy' }]);
  renderScreen({ navigate, popTo });

  await screen.findByRole('button', { name: 'Knebøy' });
  fireEvent.press(screen.getByRole('button', { name: 'Opprett øvelse' }));
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));

  expect(navigate).toHaveBeenCalledWith('CreateExercise', {
    initialName: undefined, origin: 'workout', workoutId: 9,
  });
  expect(popTo).toHaveBeenCalledWith('Workout', { focusAddExercise: true });
  expect(mockedAdd).not.toHaveBeenCalled();
});

test('retains picker choices after a failed selection write', async () => {
  mockedCount.mockResolvedValue(1);
  mockedList.mockResolvedValue([{ id: 1, name: 'Knebøy' }]);
  mockedAdd.mockRejectedValue(new Error('write failed'));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke legge til øvelsen. Prøv igjen.');
  expect(screen.getByRole('button', { name: 'Knebøy' })).toBeOnTheScreen();
});

test('shows progress on the selected exercise while storage is pending', async () => {
  let finishAdd: () => void = () => undefined;
  mockedCount.mockResolvedValue(1);
  mockedList.mockResolvedValue([{ id: 1, name: 'Knebøy' }]);
  mockedAdd.mockImplementation(() => new Promise<void>((resolve) => { finishAdd = resolve; }));
  renderScreen();

  fireEvent.press(await screen.findByRole('button', { name: 'Knebøy' }));

  expect(await screen.findByRole('button', { name: 'Legger til…' })).toHaveProp(
    'accessibilityState',
    { busy: true, disabled: true },
  );
  await act(async () => finishAdd());
});

function renderScreen(navigation: Record<string, jest.Mock> = {}) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <ExercisePickerScreen
          navigation={{ popTo: jest.fn(), ...navigation } as never}
          route={{ params: { workoutId: 9 } } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
