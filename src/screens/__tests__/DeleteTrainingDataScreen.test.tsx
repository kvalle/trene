import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { AccessibilityInfo, Modal, Text } from 'react-native';

import { DatabaseProvider } from '../../database/DatabaseContext';
import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import { deleteAllTrainingData } from '../../database/trainingData';
import { TrainingDataDeletionProvider } from '../../trainingDataDeletion';
import { AppThemeProvider } from '../../ui/AppThemeProvider';
import { DeleteTrainingDataScreen } from '../DeleteTrainingDataScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
jest.mock('../../database/trainingData', () => ({ deleteAllTrainingData: jest.fn() }));

const mockedDelete = jest.mocked(deleteAllTrainingData);

beforeEach(() => jest.clearAllMocks());

test('explains consequences and allows cancellation without offering backup creation', () => {
  const view = renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle treningsdata' }));

  expect(screen.getByText('Alle treningsøkter, inkludert en eventuell aktiv økt, og alle øvelser slettes permanent. Lag en sikkerhetskopi først hvis du vil beholde dataene.')).toBeOnTheScreen();
  expect(screen.queryByText('Lag sikkerhetskopi')).not.toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Lag sikkerhetskopi' })).not.toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));
  expect(screen.queryByTestId('delete-training-data-confirmation')).not.toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Slett alle treningsdata' }));
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(screen.queryByTestId('delete-training-data-confirmation')).not.toBeOnTheScreen();
});

test('locks dismissal and navigation while deletion is running', async () => {
  let finish!: () => void;
  mockedDelete.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle treningsdata' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle data' }));

  expect(screen.getByRole('button', { name: 'Sletter' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled();
  expect(jest.mocked(usePreventRemove)).toHaveBeenLastCalledWith(true, expect.any(Function));
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(screen.getByTestId('delete-training-data-confirmation')).toBeOnTheScreen();
  await act(async () => finish());
});

test('publishes a one-shot success after deletion completes', async () => {
  mockedDelete.mockResolvedValue();
  renderScreen(true);
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle treningsdata' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle data' }));

  expect(await screen.findByText('deleted')).toBeOnTheScreen();
  expect(mockedDelete).toHaveBeenCalledTimes(1);
});

test('keeps the screen and announces that data was unchanged after failure', async () => {
  mockedDelete.mockRejectedValue(new Error('injected failure'));
  renderScreen(true);
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle treningsdata' }));
  fireEvent.press(screen.getByRole('button', { name: 'Slett alle data' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Dataene ble ikke endret\./);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
    'Kunne ikke slette treningsdataene. Dataene ble ikke endret.',
  );
  expect(screen.getByRole('header', { name: 'Slett treningsdata' })).toBeOnTheScreen();
  expect(screen.queryByTestId('delete-training-data-confirmation')).not.toBeOnTheScreen();
  expect(screen.getByText('present')).toBeOnTheScreen();
});

function renderScreen(observeStatus = false) {
  const runtime = new DatabaseRuntime(jest.fn());
  return render(
    <TrainingDataDeletionProvider>
      {observeStatus && <DeletionStatus />}
      <DatabaseProvider database={runtime}>
        <AppThemeProvider><NavigationContainer><DeleteTrainingDataScreen /></NavigationContainer></AppThemeProvider>
      </DatabaseProvider>
    </TrainingDataDeletionProvider>,
  );
}

function DeletionStatus() {
  const { deleted } = require('../../trainingDataDeletion').useTrainingDataDeletionStatus();
  return <Text>{deleted ? 'deleted' : 'present'}</Text>;
}
