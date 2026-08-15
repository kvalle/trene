import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer, usePreventRemove } from '@react-navigation/native';
import { AccessibilityInfo, Modal } from 'react-native';

import { DataScreen } from '../DataScreen';
import { DatabaseProvider } from '../../database/DatabaseContext';
import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import { createAndShareBackup } from '../../backup/createBackup';
import { prepareRestore, RestorePreparationError } from '../../backup/prepareRestore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));

jest.mock('../../backup/createBackup', () => ({ createAndShareBackup: jest.fn() }));
jest.mock('../../backup/nativeBackupPlatform', () => ({ createNativeBackupPlatform: jest.fn(() => ({})) }));
jest.mock('../../backup/nativeRestorePlatform', () => ({ createNativeRestorePlatform: jest.fn(() => ({})) }));
jest.mock('../../backup/prepareRestore', () => ({
  prepareRestore: jest.fn(),
  RestorePreparationError: jest.requireActual('../../backup/prepareRestore').RestorePreparationError,
}));

const mockedCreateBackup = jest.mocked(createAndShareBackup);
const mockedPrepareRestore = jest.mocked(prepareRestore);

test('discloses backup sensitivity and does not claim sharing saved it', async () => {
  mockedCreateBackup.mockResolvedValue({} as never);
  renderScreen();

  expect(screen.getByText('Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte.')).toBeOnTheScreen();
  expect(screen.getByTestId('create-backup')).toHaveProp('accessibilityState', { disabled: false, busy: false });
  fireEvent.press(screen.getByRole('button', { name: 'Lag sikkerhetskopi' }));
  await act(async () => undefined);

  expect(mockedCreateBackup).toHaveBeenCalled();
  expect(screen.queryByText(/lagret/i)).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Lag sikkerhetskopi' })).toBeEnabled();
});

test('reports failure without implying live data changed', async () => {
  mockedCreateBackup.mockRejectedValue(new Error('share failed'));
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Lag sikkerhetskopi' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/Dataene dine er ikke endret/);
});

test('picker cancellation returns to Data without feedback or side effects', async () => {
  mockedPrepareRestore.mockResolvedValue({ status: 'cancelled' });
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Gjenopprett fra fil' }));

  await waitFor(() => expect(mockedPrepareRestore).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Gjenopprett fra fil' })).toBeEnabled();
});

test('prevents repeated actions while a restore is being prepared', () => {
  mockedPrepareRestore.mockImplementation(() => new Promise(() => undefined));
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Gjenopprett fra fil' }));

  expect(screen.getByRole('button', { name: 'Kontrollerer sikkerhetskopi' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Lag sikkerhetskopi' })).toBeDisabled();
});

test('previews validated creation time and database-derived counts, then cancels cleanly', async () => {
  const cancel = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  mockedPrepareRestore.mockResolvedValue({
    status: 'ready',
    restore: {
      createdAt: '2026-08-14T12:00:00.000Z',
      sourceSchemaVersion: 1,
      schemaVersion: 1,
      previewCounts: { workouts: 5, exercises: 7 },
      currentCounts: jest.fn(async () => ({ workouts: 2, exercises: 3 })),
      commit: jest.fn(async () => ({ workouts: 5, exercises: 7 })),
      cancel,
    },
  });
  const view = renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Gjenopprett fra fil' }));

  expect(await screen.findByRole('header', { name: 'Kontroller sikkerhetskopien' })).toBeOnTheScreen();
  expect(screen.getByTestId('restore-preview')).toBeOnTheScreen();
  expect(screen.getByText('5 treningsøkter')).toBeOnTheScreen();
  expect(screen.getByText('7 øvelser')).toBeOnTheScreen();
  expect(screen.getByText(/14. august 2026/)).toBeOnTheScreen();
  expect(screen.getByText('Ingenting er gjenopprettet ennå.')).toBeOnTheScreen();
  fireEvent(view.UNSAFE_getByType(Modal), 'show');

  fireEvent.press(screen.getByRole('button', { name: 'Fortsett' }));
  expect(await screen.findByRole('header', { name: 'Erstatt alle data?' })).toBeOnTheScreen();
  expect(screen.getByTestId('restore-confirmation')).toBeOnTheScreen();
  expect(screen.getByText('2 treningsøkter og 3 øvelser')).toBeOnTheScreen();
  expect(screen.getByText('5 treningsøkter og 7 øvelser')).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Avbryt' }));
  expect(cancel).toHaveBeenCalled();
  expect(screen.queryByRole('header', { name: 'Kontroller sikkerhetskopien' })).not.toBeOnTheScreen();
  expect(focus).toHaveBeenCalledTimes(0);
});

test('requires destructive confirmation and blocks navigation during commit', async () => {
  let finish!: () => void;
  const commit = jest.fn(() => new Promise<{ workouts: number; exercises: number }>((resolve) => {
    finish = () => resolve({ workouts: 5, exercises: 7 });
  }));
  mockedPrepareRestore.mockResolvedValue({
    status: 'ready',
    restore: {
      createdAt: '2026-08-14T12:00:00.000Z',
      sourceSchemaVersion: 1,
      schemaVersion: 1,
      previewCounts: { workouts: 5, exercises: 7 },
      currentCounts: async () => ({ workouts: 2, exercises: 3 }),
      commit,
      cancel: jest.fn(),
    },
  });
  renderScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Gjenopprett fra fil' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Fortsett' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Erstatt og gjenopprett' }));

  expect(commit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Gjenoppretter' })).toBeDisabled();
  expect(screen.getByTestId('confirm-restore')).toHaveProp(
    'accessibilityHint',
    'Erstatter alle data i Trene og kan ikke angres',
  );
  expect(jest.mocked(usePreventRemove)).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => finish());
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
    'Gjenopprettet 5 treningsøkter og 7 øvelser.',
  );
});

test.each([
  ['update-required', /nyere versjon av Trene/],
  ['insufficient-storage', /ikke nok ledig plass/],
  ['damaged-backup', /skadet eller kan ikke leses/],
] as const)('shows safe restore guidance for %s', async (code, message) => {
  mockedPrepareRestore.mockRejectedValue(new RestorePreparationError(code));
  renderScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Gjenopprett fra fil' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('alert')).toHaveTextContent(/Dataene dine er ikke endret/);
});

function renderScreen() {
  const runtime = new DatabaseRuntime(jest.fn());
  return render(
    <DatabaseProvider database={runtime}>
      <NavigationContainer><DataScreen /></NavigationContainer>
    </DatabaseProvider>,
  );
}
