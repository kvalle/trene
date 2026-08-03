import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import {
  createExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
} from '../../database/exercises';
import type { Database } from '../../database/types';
import { CreateExerciseScreen } from '../CreateExerciseScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));

jest.mock('../../database/exercises', () => ({
  ...jest.requireActual('../../database/exercises'),
  createExercise: jest.fn(),
}));

const database = {} as Database;
const mockedCreateExercise = jest.mocked(createExercise);

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

function renderScreen(navigation: Record<string, jest.Mock> = {}, initialName?: string) {
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <CreateExerciseScreen
          navigation={{ replace: jest.fn(), goBack: jest.fn(), ...navigation } as never}
          route={{ params: initialName === undefined ? undefined : { initialName } } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
