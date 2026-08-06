import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import { listExercises } from '../../database/exercises';
import type { Database } from '../../database/types';
import { ExercisesScreen } from '../ExercisesScreen';

jest.mock('../../database/exercises', () => ({
  ...jest.requireActual('../../database/exercises'),
  listExercises: jest.fn(),
}));
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
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

test('shows the exact usage phrase and opens detail from each whole row', async () => {
  const navigate = jest.fn();
  mockedListExercises.mockResolvedValue([
    { id: 1, name: 'Benkpress', workoutCount: 1 },
    { id: 2, name: 'Knebøy', workoutCount: 3 },
  ]);
  renderScreen({ navigate });

  await screen.findByText('Benkpress');
  expect(screen.getByText('Brukt i 1 økt')).toBeOnTheScreen();
  expect(screen.getByText('Brukt i 3 økter')).toBeOnTheScreen();
  const [singularRow, pluralRow] = screen.getAllByRole('button')
    .filter((node) => node.props.accessibilityHint === 'Åpner detaljer for øvelsen');
  expect(singularRow).toHaveProp('accessibilityRole', 'button');
  expect(pluralRow).toHaveProp('accessibilityRole', 'button');
  expect(singularRow).toHaveProp('accessibilityHint', 'Åpner detaljer for øvelsen');
  expect(pluralRow).toHaveProp('accessibilityHint', 'Åpner detaljer for øvelsen');
  fireEvent.press(pluralRow);
  expect(navigate).toHaveBeenCalledWith('ExerciseDetail', { exerciseId: 2 });
});

test('focuses a requested remaining exercise after reloading and consumes route params', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedListExercises.mockResolvedValue([{ id: 2, name: 'Knebøy', workoutCount: 0 }]);
  renderScreen({ setParams }, { focusExerciseId: 2 });

  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(setParams).toHaveBeenCalledWith({ focusExerciseId: undefined, focusEmptyAction: undefined });
});

test('clears a preserved search when it hides the requested deletion focus target', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedListExercises.mockResolvedValue([
    { id: 1, name: 'Benkpress', workoutCount: 0 },
    { id: 2, name: 'Knebøy', workoutCount: 0 },
  ]);
  const view = renderScreen({ setParams });
  fireEvent.changeText(await screen.findByLabelText('Søk i øvelser'), 'benk');

  view.rerender(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <ExercisesScreen
          navigation={{ navigate: jest.fn(), setParams } as never}
          route={{ params: { focusExerciseId: 2 } } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );

  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(screen.getByText('Knebøy')).toBeOnTheScreen();
});

test('focuses first creation after deleting the last exercise', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  const setParams = jest.fn();
  mockedListExercises.mockResolvedValue([]);
  renderScreen({ setParams }, { focusEmptyAction: true });

  await screen.findByRole('button', { name: 'Opprett første øvelse' });
  expect(focus).toHaveBeenCalled();
  expect(setParams).toHaveBeenCalledWith({ focusExerciseId: undefined, focusEmptyAction: undefined });
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

function renderScreen(
  navigation: Record<string, jest.Mock> | jest.Mock = {},
  params?: { focusExerciseId?: number; focusEmptyAction?: boolean },
) {
  const mergedNavigation = typeof navigation === 'function'
    ? { navigate: navigation }
    : navigation;
  return render(
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <ExercisesScreen
          navigation={{ navigate: jest.fn(), setParams: jest.fn(), ...mergedNavigation } as never}
          route={{ params } as never}
        />
      </NavigationContainer>
    </DatabaseProvider>,
  );
}
