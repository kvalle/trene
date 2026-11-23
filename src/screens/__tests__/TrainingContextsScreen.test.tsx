import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import {
  createTrainingContext,
  DuplicateTrainingContextNameError,
  DUPLICATE_TRAINING_CONTEXT_NAME,
  listTrainingContexts,
  loadTrainingContextDetail,
  renameTrainingContext,
  TrainingContextNotFoundError,
} from '../../database/trainingContexts';
import type { Database } from '../../database/types';
import { EXERCISE_NAME_REQUIRED } from '../../domain/exerciseName';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { CreateTrainingContextScreen } from '../CreateTrainingContextScreen';
import { TrainingContextDetailScreen } from '../TrainingContextDetailScreen';
import { TrainingContextsScreen } from '../TrainingContextsScreen';

jest.mock('../../database/trainingContexts', () => ({
  ...jest.requireActual('../../database/trainingContexts'),
  createTrainingContext: jest.fn(),
  listTrainingContexts: jest.fn(),
  loadTrainingContextDetail: jest.fn(),
  renameTrainingContext: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: jest.fn((node) => node ? 12 : null),
}));

const database = {} as Database;
const mockedList = jest.mocked(listTrainingContexts);
const mockedCreate = jest.mocked(createTrainingContext);
const mockedLoad = jest.mocked(loadTrainingContextDetail);
const mockedRename = jest.mocked(renameTrainingContext);

beforeEach(() => {
  jest.clearAllMocks();
  mockedRename.mockResolvedValue();
});

function wrap(children: React.ReactNode) {
  return render(
    <AppThemeProvider scheme="light">
      <DatabaseProvider database={database}>
        <NavigationContainer>{children}</NavigationContainer>
      </DatabaseProvider>
    </AppThemeProvider>,
  );
}

function renderList(navigation: Record<string, jest.Mock> = {}, params?: { createdTrainingContextId?: number }) {
  return wrap(
    <TrainingContextsScreen
      navigation={{ navigate: jest.fn(), setParams: jest.fn(), ...navigation } as never}
      route={{ params } as never}
    />,
  );
}

function renderCreate(navigation: Record<string, jest.Mock> = {}) {
  return wrap(
    <CreateTrainingContextScreen
      navigation={{ dispatch: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), ...navigation } as never}
      route={{} as never}
    />,
  );
}

function renderDetail(navigation: Record<string, jest.Mock> = {}) {
  return wrap(
    <TrainingContextDetailScreen
      navigation={{ dispatch: jest.fn(), popTo: jest.fn(), ...navigation } as never}
      route={{ params: { trainingContextId: 3 } } as never}
    />,
  );
}

describe('Kontekster list', () => {
  test('explains why to create more when there is exactly one kontekst', async () => {
    mockedList.mockResolvedValue([{ id: 1, name: 'Standard', workoutCount: 1 }]);
    renderList();

    expect(await screen.findByText('Standard')).toBeOnTheScreen();
    expect(screen.getByText('1 trening')).toBeOnTheScreen();
    expect(screen.getByText(/fysioøvelser hjemme og styrke på/)).toBeOnTheScreen();
  });

  test('lists each kontekst with its count and opens detail and creation', async () => {
    const navigate = jest.fn();
    mockedList.mockResolvedValue([
      { id: 1, name: 'Fysio', workoutCount: 12 },
      { id: 2, name: 'Treningssenter', workoutCount: 0 },
    ]);
    renderList({ navigate });

    expect(await screen.findByText('12 treninger')).toBeOnTheScreen();
    expect(screen.getByText('0 treninger')).toBeOnTheScreen();
    expect(screen.queryByText(/fysioøvelser hjemme/)).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText('Treningssenter'));
    expect(navigate).toHaveBeenCalledWith('TrainingContextDetail', { trainingContextId: 2 });
    fireEvent.press(screen.getByRole('button', { name: 'Ny kontekst' }));
    expect(navigate).toHaveBeenCalledWith('CreateTrainingContext');
  });

  test('confirms a created kontekst with a positive status and focuses its row', async () => {
    const setParams = jest.fn();
    mockedList.mockResolvedValue([
      { id: 1, name: 'Fysio', workoutCount: 0 },
      { id: 2, name: 'Standard', workoutCount: 3 },
    ]);
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    renderList({ setParams }, { createdTrainingContextId: 1 });

    expect(await screen.findByText('Konteksten er opprettet.')).toBeOnTheScreen();
    await waitFor(() => expect(setParams).toHaveBeenCalledWith({ createdTrainingContextId: undefined }));
    expect(focus).toHaveBeenCalled();
  });

  test('offers retry when loading fails', async () => {
    mockedList.mockRejectedValueOnce(new Error('boom'));
    mockedList.mockResolvedValueOnce([{ id: 1, name: 'Standard', workoutCount: 0 }]);
    renderList();

    fireEvent.press(await screen.findByRole('button', { name: 'Prøv igjen' }));
    expect(await screen.findByText('Standard')).toBeOnTheScreen();
  });
});

describe('Ny kontekst', () => {
  test('requires a name', async () => {
    renderCreate();

    fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));
    expect(await screen.findByText(EXERCISE_NAME_REQUIRED)).toBeOnTheScreen();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  test('shows a field error for a duplicate name', async () => {
    mockedCreate.mockRejectedValue(new DuplicateTrainingContextNameError());
    renderCreate();

    fireEvent.changeText(screen.getByLabelText('Navn'), 'standard');
    fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));
    expect(await screen.findByText(DUPLICATE_TRAINING_CONTEXT_NAME)).toBeOnTheScreen();
  });

  test('creates a normalised kontekst and returns to the list', async () => {
    const popTo = jest.fn();
    mockedCreate.mockResolvedValue(5);
    renderCreate({ popTo });

    fireEvent.changeText(screen.getByLabelText('Navn'), '  Fysio   hjemme ');
    fireEvent.press(screen.getByRole('button', { name: 'Opprett' }));
    await waitFor(() => expect(popTo).toHaveBeenCalledWith('TrainingContexts', { createdTrainingContextId: 5 }));
    expect(mockedCreate).toHaveBeenCalledWith(database, 'Fysio hjemme', 'fysio hjemme');
  });
});

describe('Kontekst detail', () => {
  const detail = { id: 3, name: 'Fysio', workoutCount: 4, lastExercises: ['Utadrotasjon', 'Skulderpress'] };

  test('shows name, count and the last exercises as a plain list', async () => {
    mockedLoad.mockResolvedValue(detail);
    renderDetail();

    expect(await screen.findByRole('header', { name: 'Fysio' })).toBeOnTheScreen();
    expect(screen.getByText('4 treninger')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Øvelser sist' })).toBeOnTheScreen();
    expect(screen.getByText('Utadrotasjon')).toBeOnTheScreen();
    expect(screen.getByText('Skulderpress')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Utadrotasjon/ })).not.toBeOnTheScreen();
  });

  test('shows "Ingen ennå." without exercises', async () => {
    mockedLoad.mockResolvedValue({ ...detail, workoutCount: 0, lastExercises: [] });
    renderDetail();

    expect(await screen.findByText('Ingen ennå.')).toBeOnTheScreen();
    expect(screen.getByText('0 treninger')).toBeOnTheScreen();
  });

  test('renames with validation and duplicate errors', async () => {
    mockedLoad.mockResolvedValue(detail);
    renderDetail();
    const input = await screen.findByLabelText('Navn');

    fireEvent.changeText(input, '   ');
    fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));
    expect(await screen.findByText(EXERCISE_NAME_REQUIRED)).toBeOnTheScreen();
    expect(mockedRename).not.toHaveBeenCalled();

    mockedRename.mockRejectedValueOnce(new DuplicateTrainingContextNameError());
    fireEvent.changeText(input, 'Standard');
    fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));
    expect(await screen.findByText(DUPLICATE_TRAINING_CONTEXT_NAME)).toBeOnTheScreen();

    fireEvent.changeText(input, ' Hjemme ');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Lagre navn' }));
    });
    expect(mockedRename).toHaveBeenLastCalledWith(database, 3, 'Hjemme', 'hjemme');
    expect(await screen.findByRole('header', { name: 'Hjemme' })).toBeOnTheScreen();
    expect(screen.queryByText(DUPLICATE_TRAINING_CONTEXT_NAME)).not.toBeOnTheScreen();
  });

  test('shows a missing state when the kontekst no longer exists', async () => {
    const popTo = jest.fn();
    mockedLoad.mockResolvedValue(detail);
    mockedRename.mockRejectedValue(new TrainingContextNotFoundError());
    renderDetail({ popTo });

    fireEvent.press(await screen.findByRole('button', { name: 'Lagre navn' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Tilbake til kontekster' }));
    expect(popTo).toHaveBeenCalledWith('TrainingContexts');
  });
});
