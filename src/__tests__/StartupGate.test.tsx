import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useState } from 'react';

import { StartupGate } from '../StartupGate';
import type { Database } from '../database/types';
import { useDatabase } from '../database/DatabaseContext';
import type { DatabaseRuntime } from '../database/DatabaseRuntime';

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
