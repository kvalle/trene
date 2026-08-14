import {
  DatabaseMaintenanceError,
  DatabaseRuntime,
} from '../DatabaseRuntime';
import type { Database } from '../types';

test('opens once and runs overlapping operations on the active database', async () => {
  const database = fakeDatabase();
  const runtime = new DatabaseRuntime(jest.fn(async () => database));
  const first = deferred<void>();
  const secondStarted = jest.fn();
  await runtime.start();

  const operation = runtime.runOperation(async (leased) => {
    expect(leased).not.toBe(database);
    await first.promise;
  });
  const overlapping = runtime.runOperation(async () => secondStarted());

  expect(secondStarted).toHaveBeenCalled();
  first.resolve();
  await Promise.all([operation, overlapping]);
});

test('exclusive maintenance rejects new work and waits for active operations', async () => {
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  const operationCanFinish = deferred<void>();
  const maintenanceStarted = jest.fn();
  await runtime.start();
  const operation = runtime.runOperation(() => operationCanFinish.promise);

  const maintenance = runtime.runExclusive(async () => maintenanceStarted());

  await expect(runtime.runOperation(async () => undefined)).rejects.toBeInstanceOf(
    DatabaseMaintenanceError,
  );
  expect(maintenanceStarted).not.toHaveBeenCalled();
  operationCanFinish.resolve();
  await operation;
  await maintenance;
  expect(maintenanceStarted).toHaveBeenCalled();
});

test('maintenance waits for detached native work before it starts', async () => {
  const nativeCall = deferred<void>();
  const database = fakeDatabase();
  database.execAsync = jest.fn(() => nativeCall.promise);
  const runtime = new DatabaseRuntime(async () => database);
  const maintenanceStarted = jest.fn();
  await runtime.start();

  const operation = runtime.runOperation(async (leased) => {
    void leased.execAsync('UPDATE workouts');
  });
  const maintenance = runtime.runExclusive(async () => maintenanceStarted());

  expect(maintenanceStarted).not.toHaveBeenCalled();
  nativeCall.resolve();
  await operation;
  await maintenance;
  expect(maintenanceStarted).toHaveBeenCalled();
});

test('expires operation and maintenance database leases', async () => {
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  let operationLease!: Database;
  let maintenanceLease!: Database;
  let escapedMaintenance!: Parameters<Parameters<DatabaseRuntime['runExclusive']>[0]>[0];
  await runtime.start();

  await runtime.runOperation(async (database) => {
    operationLease = database;
  });
  await runtime.runExclusive((maintenance) => {
    escapedMaintenance = maintenance;
    return maintenance.run(async (database) => {
      maintenanceLease = database;
    });
  });

  await expect(operationLease.getAllAsync('SELECT 1')).rejects.toThrow('lease has expired');
  await expect(maintenanceLease.getAllAsync('SELECT 1')).rejects.toThrow('lease has expired');
  await expect(escapedMaintenance.run(async () => undefined)).rejects.toThrow(
    'maintenance lease has expired',
  );
  await expect(runtime.runOperation((database) => database.closeAsync())).rejects.toThrow(
    'Only the database runtime',
  );
});

test('reopens under maintenance and publishes one new generation', async () => {
  const first = fakeDatabase();
  const second = fakeDatabase();
  const open = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const runtime = new DatabaseRuntime(open);
  const listener = jest.fn();
  let listenerOperation!: Promise<void>;
  runtime.subscribe(() => {
    listener();
    listenerOperation = runtime.runOperation(async () => undefined);
  });
  await runtime.start();

  await runtime.runExclusive((maintenance) => maintenance.reopen());

  expect(first.closeAsync).toHaveBeenCalledTimes(1);
  expect(runtime.getGeneration()).toBe(1);
  expect(listener).toHaveBeenCalledTimes(1);
  await expect(listenerOperation).resolves.toBeUndefined();
  await runtime.runOperation(async (database) => {
    await database.execAsync('SELECT 1');
  });
  expect(second.execAsync).toHaveBeenCalledWith('SELECT 1');
});

test('keeps generation unchanged and remains retryable after reopen failure', async () => {
  const first = fakeDatabase();
  const recovered = fakeDatabase();
  const open = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error('open failed'))
    .mockResolvedValueOnce(recovered);
  const runtime = new DatabaseRuntime(open);
  await runtime.start();

  await expect(runtime.runExclusive((maintenance) => maintenance.reopen())).rejects.toThrow(
    'open failed',
  );
  expect(runtime.getGeneration()).toBe(0);
  await expect(runtime.runOperation(async () => undefined)).rejects.toThrow(
    'Database is not available',
  );

  await runtime.runExclusive((maintenance) => maintenance.reopen());
  expect(runtime.getGeneration()).toBe(1);
});

test('does not publish a reopened generation until maintenance is released', async () => {
  const open = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(fakeDatabase())
    .mockResolvedValueOnce(fakeDatabase());
  const runtime = new DatabaseRuntime(open);
  await runtime.start();

  await runtime.runExclusive(async (maintenance) => {
    await maintenance.reopen();
    expect(runtime.getGeneration()).toBe(0);
  });

  expect(runtime.getGeneration()).toBe(1);
});

test('requires maintenance reopen after a failed reopen', async () => {
  const open = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(fakeDatabase())
    .mockRejectedValueOnce(new Error('open failed'));
  const runtime = new DatabaseRuntime(open);
  await runtime.start();
  await expect(runtime.runExclusive((maintenance) => maintenance.reopen())).rejects.toThrow(
    'open failed',
  );

  await expect(runtime.start()).rejects.toThrow('Database is not available');
  expect(runtime.getGeneration()).toBe(0);
});

test('close waits for active work, closes once, and prevents later operations', async () => {
  const database = fakeDatabase();
  const runtime = new DatabaseRuntime(async () => database);
  const operationCanFinish = deferred<void>();
  await runtime.start();
  const operation = runtime.runOperation(() => operationCanFinish.promise);

  const closing = runtime.close();
  expect(database.closeAsync).not.toHaveBeenCalled();
  operationCanFinish.resolve();
  await operation;
  await Promise.all([closing, runtime.close()]);

  expect(database.closeAsync).toHaveBeenCalledTimes(1);
  await expect(runtime.runOperation(async () => undefined)).rejects.toThrow('runtime is closed');
});

test('close waits for exclusive maintenance before closing the database', async () => {
  const database = fakeDatabase();
  const runtime = new DatabaseRuntime(async () => database);
  const maintenanceCanFinish = deferred<void>();
  await runtime.start();
  const maintenance = runtime.runExclusive(() => maintenanceCanFinish.promise);

  const closing = runtime.close();
  expect(database.closeAsync).not.toHaveBeenCalled();
  maintenanceCanFinish.resolve();
  await maintenance;
  await closing;

  expect(database.closeAsync).toHaveBeenCalledTimes(1);
});

test('shares one in-flight startup between concurrent callers', async () => {
  const database = fakeDatabase();
  const opening = deferred<Database>();
  const open = jest.fn(() => opening.promise);
  const runtime = new DatabaseRuntime(open);

  const first = runtime.start();
  const second = runtime.start();
  opening.resolve(database);
  await Promise.all([first, second]);

  expect(open).toHaveBeenCalledTimes(1);
});

test('serializes maintenance database work and reopen', async () => {
  const first = fakeDatabase();
  const second = fakeDatabase();
  const firstWork = deferred<void>();
  const open = jest.fn<Promise<Database>, []>()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const runtime = new DatabaseRuntime(open);
  await runtime.start();

  await runtime.runExclusive(async (maintenance) => {
    const work = maintenance.run(async (database) => {
      await database.execAsync('SELECT 1');
      await firstWork.promise;
    });
    const reopening = maintenance.reopen();
    expect(first.closeAsync).not.toHaveBeenCalled();
    firstWork.resolve();
    await Promise.all([work, reopening]);
  });

  expect(first.closeAsync).toHaveBeenCalledTimes(1);
  expect(runtime.getGeneration()).toBe(1);
});

test('does not allow startup to open another connection during maintenance', async () => {
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();

  await runtime.runExclusive(async () => {
    await expect(runtime.start()).rejects.toBeInstanceOf(DatabaseMaintenanceError);
  });
});

test('closes a database that finishes opening after shutdown begins', async () => {
  const database = fakeDatabase();
  const opening = deferred<Database>();
  const runtime = new DatabaseRuntime(() => opening.promise);
  const startup = runtime.start();

  const closing = runtime.close();
  opening.resolve(database);
  await expect(startup).rejects.toThrow('runtime is closed');
  await closing;

  expect(database.closeAsync).toHaveBeenCalledTimes(1);
});

function fakeDatabase(): Database {
  return {
    closeAsync: jest.fn(async () => undefined),
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
