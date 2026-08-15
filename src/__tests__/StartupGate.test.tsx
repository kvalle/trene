import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useState } from 'react';

import { StartupGate } from '../StartupGate';
import type { Database } from '../database/types';
import { useDatabase } from '../database/DatabaseContext';
import type { DatabaseRuntime } from '../database/DatabaseRuntime';
import { cleanupAbandonedBackupExports } from '../backup/nativeBackupPlatform';
import { cleanupAbandonedRestorePreparations } from '../backup/nativeRestorePlatform';
import { recoverInterruptedRestore, RestoreSafeStopError } from '../backup/recoverRestore';

jest.mock('../backup/nativeBackupPlatform', () => ({ cleanupAbandonedBackupExports: jest.fn(async () => undefined) }));
jest.mock('../backup/nativeRestorePlatform', () => ({
  cleanupAbandonedRestorePreparations: jest.fn(async () => undefined),
  createNativeRestoreRecoveryPlatform: jest.fn(() => ({})),
}));
jest.mock('../backup/recoverRestore', () => ({
  ...jest.requireActual('../backup/recoverRestore'),
  recoverInterruptedRestore: jest.fn(async () => null),
}));

const mockedCleanup = jest.mocked(cleanupAbandonedBackupExports);
const mockedRestoreCleanup = jest.mocked(cleanupAbandonedRestorePreparations);
const mockedRecovery = jest.mocked(recoverInterruptedRestore);

beforeEach(() => {
  jest.clearAllMocks();
  mockedCleanup.mockResolvedValue();
  mockedRestoreCleanup.mockResolvedValue();
  mockedRecovery.mockResolvedValue(null);
});

const database: Database = {
  closeAsync: jest.fn(async () => undefined),
  execAsync: jest.fn(async () => undefined),
  getFirstAsync: jest.fn(async () => null),
  getAllAsync: jest.fn(async () => []),
  runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
};

test('blocks the app until startup succeeds and retries manually', async () => {
  const firstAttempt = deferred<Database>();
  const openDatabase = jest.fn<Promise<Database>, []>()
    .mockReturnValueOnce(firstAttempt.promise)
    .mockResolvedValueOnce(database);

  await render(
    <StartupGate openDatabase={openDatabase}>
      <Text>Navigation er klar</Text>
    </StartupGate>,
  );

  await act(async () => {
    firstAttempt.reject(new Error('failed'));
  });

  expect(screen.getByText('Trene kunne ikke starte')).toBeOnTheScreen();
  expect(screen.queryByText('Navigation er klar')).not.toBeOnTheScreen();
  expect(screen.getByText('Dataene dine er ikke endret. Prøv å starte på nytt.')).toBeOnTheScreen();

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
  });

  await waitFor(() => expect(screen.getByText('Navigation er klar')).toBeOnTheScreen());
  expect(openDatabase).toHaveBeenCalledTimes(2);
});

test('does not open the database when abandoned export cleanup fails', async () => {
  mockedCleanup.mockRejectedValueOnce(new Error('cleanup failed'));
  const openDatabase = jest.fn(async () => database);

  render(<StartupGate openDatabase={openDatabase}><Text>Navigation er klar</Text></StartupGate>);

  expect(await screen.findByText('Trene kunne ikke starte')).toBeOnTheScreen();
  expect(openDatabase).not.toHaveBeenCalled();
});

test('opens the database before cleaning abandoned restore preparations', async () => {
  mockedRestoreCleanup.mockRejectedValueOnce(new Error('cleanup failed'));
  const openDatabase = jest.fn(async () => database);

  render(<StartupGate openDatabase={openDatabase}><Text>Navigation er klar</Text></StartupGate>);

  expect(await screen.findByText('Navigation er klar')).toBeOnTheScreen();
  expect(openDatabase).toHaveBeenCalledTimes(1);
  expect(mockedRestoreCleanup).toHaveBeenCalledTimes(1);
});

test('adds restart guidance after persistent failure', async () => {
  const firstAttempt = deferred<Database>();
  const secondAttempt = deferred<Database>();
  const openDatabase = jest.fn<Promise<Database>, []>()
    .mockReturnValueOnce(firstAttempt.promise)
    .mockReturnValueOnce(secondAttempt.promise);
  await render(
    <StartupGate openDatabase={openDatabase}>
      <Text>Navigation er klar</Text>
    </StartupGate>,
  );

  await act(async () => {
    firstAttempt.reject(new Error('failed'));
  });

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Prøv igjen' }));
    secondAttempt.reject(new Error('failed again'));
  });

  expect(
    await screen.findByText('Hvis problemet fortsetter, avslutt appen helt og åpne den igjen.'),
  ).toBeOnTheScreen();
});

test('shows a non-retry safe stop without opening the database', async () => {
  mockedRecovery.mockRejectedValueOnce(new RestoreSafeStopError(new Error('both invalid')));
  const openDatabase = jest.fn(async () => database);

  render(<StartupGate openDatabase={openDatabase}><Text>Navigation er klar</Text></StartupGate>);

  expect(await screen.findByRole('header', { name: 'Trene kan ikke åpne dataene trygt' })).toBeOnTheScreen();
  expect(screen.UNSAFE_getByProps({ accessibilityLiveRegion: 'assertive' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Prøv igjen' })).not.toBeOnTheScreen();
  expect(screen.getByText('Ikke slett eller installer appen på nytt.')).toBeOnTheScreen();
  expect(openDatabase).not.toHaveBeenCalled();
});

test('cleans recovery artifacts only after the recovered database remounts', async () => {
  const cleanup = jest.fn();
  mockedRecovery.mockResolvedValueOnce(cleanup);
  const openDatabase = jest.fn(async () => database);

  render(<StartupGate openDatabase={openDatabase}><Text>Navigation er klar</Text></StartupGate>);

  expect(await screen.findByText('Navigation er klar')).toBeOnTheScreen();
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('remounts data-dependent state after a successful database reopen', async () => {
  const secondDatabase = { ...database, closeAsync: jest.fn(async () => undefined) };
  const openDatabase = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(database)
    .mockResolvedValueOnce(secondDatabase);
  let runtime!: DatabaseRuntime;

  function Session() {
    runtime = useDatabase() as DatabaseRuntime;
    const [value, setValue] = useState('fresh');
    return <Text onPress={() => setValue('stale')}>{value}</Text>;
  }

  await render(
    <StartupGate openDatabase={openDatabase}>
      <Session />
    </StartupGate>,
  );
  fireEvent.press(await screen.findByText('fresh'));
  expect(screen.getByText('stale')).toBeOnTheScreen();

  await act(async () => {
    await runtime.runExclusive((maintenance) => maintenance.reopen());
  });

  expect(screen.getByText('fresh')).toBeOnTheScreen();
});

function deferred<T>() {
  let reject!: (reason: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
