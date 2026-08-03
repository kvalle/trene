import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import { listExercises } from '../../database/exercises';
import type { Database } from '../../database/types';
import { ExercisesScreen } from '../ExercisesScreen';

jest.mock('../../database/exercises', () => ({
  ...jest.requireActual('../../database/exercises'),
  listExercises: jest.fn(),
}));

const database = {} as Database;
const mockedListExercises = jest.mocked(listExercises);

beforeEach(() => jest.clearAllMocks());

test('shows first creation as the only empty-state action', async () => {
  mockedListExercises.mockResolvedValue([]);
  renderScreen();

  expect(await screen.findByRole('button', { name: 'Opprett første øvelse' })).toBeOnTheScreen();
  expect(screen.queryByLabelText('Søk i øvelser')).not.toBeOnTheScreen();
});

test('searches substrings and prefills creation when there are no matches', async () => {
  const navigate = jest.fn();
  mockedListExercises.mockResolvedValue([{ id: 1, name: 'Knebøy', workoutCount: 1 }]);
  renderScreen(navigate);

  fireEvent.changeText(await screen.findByLabelText('Søk i øvelser'), 'mark');
  expect(screen.getByText('Ingen øvelser funnet')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Opprett «mark»' }));
  expect(navigate).toHaveBeenCalledWith('CreateExercise', { initialName: 'mark' });
});

test('retries a failed read only when requested', async () => {
  mockedListExercises
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce([]);
  renderScreen();

  expect(await screen.findByText('Kunne ikke laste inn')).toBeOnTheScreen();
  expect(mockedListExercises).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  await waitFor(() => expect(screen.getByText('Opprett første øvelse')).toBeOnTheScreen());
  expect(mockedListExercises).toHaveBeenCalledTimes(2);
});

function renderScreen(navigate = jest.fn()) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <ExercisesScreen navigation={{ navigate } as never} route={{} as never} />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
