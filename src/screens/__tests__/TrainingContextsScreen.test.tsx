import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import {
  activateTrainingContext,
  archiveTrainingContext,
  createTrainingContext,
  deleteTrainingContext,
  LastActiveTrainingContextError,
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
  activateTrainingContext: jest.fn(),
  archiveTrainingContext: jest.fn(),
  createTrainingContext: jest.fn(),
  deleteTrainingContext: jest.fn(),
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
const mockedArchive = jest.mocked(archiveTrainingContext);
const mockedActivate = jest.mocked(activateTrainingContext);
const mockedDelete = jest.mocked(deleteTrainingContext);

beforeEach(() => {
  jest.clearAllMocks();
  mockedRename.mockResolvedValue();
  mockedArchive.mockResolvedValue();
  mockedActivate.mockResolvedValue();
  mockedDelete.mockResolvedValue();
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

function renderList(navigation: Record<string, jest.Mock> = {}, params?: { createdTrainingContextId?: number; deletedTrainingContext?: boolean }) {
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
    mockedList.mockResolvedValue([{ id: 1, name: 'Standard', archived: false, workoutCount: 1 }]);
    renderList();

    expect(await screen.findByText('Standard')).toBeOnTheScreen();
    expect(screen.getByText('1 trening')).toBeOnTheScreen();
    expect(screen.getByText(/fysioøvelser hjemme og styrke på/)).toBeOnTheScreen();
  });

  test('lists each kontekst with its count and opens detail and creation', async () => {
    const navigate = jest.fn();
    mockedList.mockResolvedValue([
      { id: 1, name: 'Fysio', archived: false, workoutCount: 12 },
      { id: 2, name: 'Treningssenter', archived: false, workoutCount: 0 },
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
      { id: 1, name: 'Fysio', archived: false, workoutCount: 0 },
      { id: 2, name: 'Standard', archived: false, workoutCount: 3 },
    ]);
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    renderList({ setParams }, { createdTrainingContextId: 1 });

    expect(await screen.findByText('Konteksten er opprettet.')).toBeOnTheScreen();
    await waitFor(() => expect(setParams).toHaveBeenCalledWith({ createdTrainingContextId: undefined }));
    expect(focus).toHaveBeenCalled();
  });

  test('groups archived kontekster under "Arkivert"', async () => {
    mockedList.mockResolvedValue([
      { id: 1, name: 'Fysio', archived: true, workoutCount: 2 },
      { id: 2, name: 'Standard', archived: false, workoutCount: 3 },
    ]);
    renderList();

    expect(await screen.findByRole('header', { name: 'Arkivert' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('training-contexts-archived')).getByText('Fysio')).toBeOnTheScreen();
    expect(within(screen.getByTestId('training-contexts-archived')).queryByText('Standard')).not.toBeOnTheScreen();
  });

  test('has no "Arkivert" section without archived kontekster', async () => {
    mockedList.mockResolvedValue([{ id: 1, name: 'Standard', archived: false, workoutCount: 0 }]);
    renderList();

    expect(await screen.findByText('Standard')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Arkivert' })).not.toBeOnTheScreen();
  });

  test('confirms a deleted kontekst with a positive status', async () => {
    const setParams = jest.fn();
    mockedList.mockResolvedValue([{ id: 1, name: 'Standard', archived: false, workoutCount: 0 }]);
    renderList({ setParams }, { deletedTrainingContext: true });

    expect(await screen.findByText('Konteksten er slettet.')).toBeOnTheScreen();
    expect(setParams).toHaveBeenCalledWith({ deletedTrainingContext: undefined });
  });

  test('offers retry when loading fails', async () => {
    mockedList.mockRejectedValueOnce(new Error('boom'));
    mockedList.mockResolvedValueOnce([{ id: 1, name: 'Standard', archived: false, workoutCount: 0 }]);
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
  const detail = {
    id: 3,
    name: 'Fysio',
    archived: false,
    workoutCount: 4,
    lastExercises: ['Utadrotasjon', 'Skulderpress'],
    hasActiveWorkout: false,
    isLastActive: false,
  };
  const unused = { ...detail, workoutCount: 0, lastExercises: [] };

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

  test('archives after confirmation and shows the kontekst as archived', async () => {
    mockedLoad.mockResolvedValueOnce(detail).mockResolvedValue({ ...detail, archived: true });
    renderDetail();

    expect(await screen.findByText(/vises ikke når du starter en trening. Tidligere treninger beholdes/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Arkiver kontekst' }));
    expect(await screen.findByText('Arkiver Fysio?')).toBeOnTheScreen();
    expect(mockedArchive).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('training-context-archive-confirm'));
    });

    expect(mockedArchive).toHaveBeenCalledWith(database, 3);
    expect(await screen.findByText('Konteksten er arkivert.')).toBeOnTheScreen();
    expect(screen.getByTestId('training-context-archived-badge')).toHaveTextContent('Arkivert');
    expect(screen.getByRole('button', { name: 'Aktiver kontekst' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Arkiver kontekst' })).not.toBeOnTheScreen();
  });

  test('cancels archiving without changes', async () => {
    mockedLoad.mockResolvedValue(detail);
    renderDetail();

    fireEvent.press(await screen.findByRole('button', { name: 'Arkiver kontekst' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Avbryt' }));
    await waitFor(() => expect(screen.queryByText('Arkiver Fysio?')).not.toBeOnTheScreen());
    expect(mockedArchive).not.toHaveBeenCalled();
  });

  test('disables archiving the last active kontekst with an explanation', async () => {
    mockedLoad.mockResolvedValue({ ...detail, isLastActive: true });
    renderDetail();

    expect(await screen.findByText(/Du må ha minst én aktiv kontekst for å kunne starte en trening/)).toBeOnTheScreen();
    expect(screen.getByTestId('training-context-archive')).toBeDisabled();
  });

  test('explains when the database rejects archiving the last active kontekst', async () => {
    mockedLoad.mockResolvedValue(detail);
    mockedArchive.mockRejectedValue(new LastActiveTrainingContextError());
    renderDetail();

    fireEvent.press(await screen.findByRole('button', { name: 'Arkiver kontekst' }));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('training-context-archive-confirm'));
    });
    expect(await screen.findByText('Konteksten er den eneste aktive og kan ikke arkiveres.')).toBeOnTheScreen();
  });

  test('activates an archived kontekst with an explanation and a positive status', async () => {
    mockedLoad.mockResolvedValueOnce({ ...detail, archived: true }).mockResolvedValue(detail);
    renderDetail();

    expect(await screen.findByTestId('training-context-archived-badge')).toBeOnTheScreen();
    expect(screen.getByText(/kan du velge den igjen når du starter en trening/)).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Aktiver kontekst' }));
    });

    expect(mockedActivate).toHaveBeenCalledWith(database, 3);
    expect(await screen.findByText('Konteksten er aktivert.')).toBeOnTheScreen();
    expect(screen.queryByTestId('training-context-archived-badge')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Arkiver kontekst' })).toBeOnTheScreen();
  });

  test.each([
    ['history', { workoutCount: 2 }, /har tidligere treninger og kan ikke slettes. Arkiver den i stedet/],
    ['the active treningsøkt', { hasActiveWorkout: true, workoutCount: 0 }, /brukes av treningen som pågår/],
    ['being the last active kontekst', { workoutCount: 0, isLastActive: true }, /Du må ha minst én aktiv kontekst. Lag eller aktiver/],
  ])('disables delete with an explanation because of %s', async (_reason, overrides, explanation) => {
    mockedLoad.mockResolvedValue({ ...detail, ...overrides });
    renderDetail();

    expect(await screen.findByText(explanation)).toBeOnTheScreen();
    expect(screen.getByTestId('training-context-delete')).toBeDisabled();
  });

  test('deletes an unused kontekst after confirmation and returns to the list', async () => {
    const popTo = jest.fn();
    mockedLoad.mockResolvedValue(unused);
    renderDetail({ popTo });

    expect(await screen.findByText('Konteksten har ingen treninger og kan slettes.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Slett kontekst' }));
    expect(await screen.findByText('Slett Fysio?')).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('training-context-delete-confirm'));
    });

    expect(mockedDelete).toHaveBeenCalledWith(database, 3);
    expect(popTo).toHaveBeenCalledWith('TrainingContexts', { deletedTrainingContext: true });
  });

  test('explains a failed delete and reloads the kontekst', async () => {
    mockedLoad.mockResolvedValueOnce(unused).mockResolvedValue({ ...unused, hasActiveWorkout: true });
    mockedDelete.mockRejectedValue(new Error('boom'));
    renderDetail();

    fireEvent.press(await screen.findByRole('button', { name: 'Slett kontekst' }));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('training-context-delete-confirm'));
    });

    expect(await screen.findByText('Kunne ikke slette konteksten. Prøv igjen.')).toBeOnTheScreen();
    expect(await screen.findByText(/brukes av treningen som pågår/)).toBeOnTheScreen();
  });
});
