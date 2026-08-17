import { inspectDatabase, type DatabaseInspection } from '../../database/inspectDatabase';
import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import type { Database } from '../../database/types';
import type { BackupArtifact } from '../createBackup';
import {
  commitPreparedRestore,
  RestoreCommitError,
  type RestoreCommitPlatform,
  type RollbackSnapshot,
} from '../commitRestore';

jest.mock('../../database/inspectDatabase', () => ({ inspectDatabase: jest.fn() }));

const original: DatabaseInspection = {
  schemaVersion: 1,
  tableCounts: { exercises: 2, workouts: 1, workout_exercises: 1, workout_sets: 1 },
  previewCounts: { exercises: 2, workouts: 1 },
  semanticDigest: '1'.repeat(64),
};
const restored: DatabaseInspection = {
  schemaVersion: 1,
  tableCounts: { exercises: 4, workouts: 3, workout_exercises: 5, workout_sets: 8 },
  previewCounts: { exercises: 4, workouts: 3 },
  semanticDigest: '2'.repeat(64),
};
const rollback: RollbackSnapshot = {
  size: 1024,
  sha256: 'a'.repeat(64),
  schemaVersion: 1,
  tableCounts: original.tableCounts,
  semanticDigest: original.semanticDigest,
};

beforeEach(() => jest.clearAllMocks());

test('replaces all data, validates the active database, and publishes a fresh generation', async () => {
  const runtime = runtimeWithConnections(2);
  const platform = fakePlatform();
  const artifact = fakeArtifact();
  jest.mocked(inspectDatabase)
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(restored);
  await runtime.start();
  runtime.subscribe(() => runtime.confirmGeneration(runtime.getGeneration()));

  await expect(commitPreparedRestore(runtime, platform, artifact, restored)).resolves.toEqual(restored);

  expect(platform.writeRestoreMarker).toHaveBeenNthCalledWith(1, 'rollback-ready', rollback, restored);
  expect(platform.writeRestoreMarker).toHaveBeenNthCalledWith(2, 'replacement-started', rollback, restored);
  expect(platform.writeRestoreMarker).toHaveBeenNthCalledWith(3, 'replacement-verified', rollback, restored);
  expect(platform.activateDatabase).toHaveBeenCalledWith(artifact);
  expect(platform.activateRollback).not.toHaveBeenCalled();
  expect(platform.cleanupRestoreCommit).toHaveBeenCalledTimes(1);
  expect(artifact.remove).toHaveBeenCalledTimes(1);
  expect(runtime.getGeneration()).toBe(1);
});

test('restores and fully validates the original database when active validation fails', async () => {
  const runtime = runtimeWithConnections(3);
  const platform = fakePlatform();
  const artifact = fakeArtifact();
  jest.mocked(inspectDatabase)
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new Error('candidate is invalid'))
    .mockResolvedValueOnce(original);
  await runtime.start();
  runtime.subscribe(() => runtime.confirmGeneration(runtime.getGeneration()));

  await expect(commitPreparedRestore(runtime, platform, artifact, restored)).rejects.toEqual(
    new RestoreCommitError('unchanged'),
  );

  expect(platform.verifyRollbackSnapshot).toHaveBeenCalledTimes(2);
  expect(platform.activateRollback).toHaveBeenCalledTimes(1);
  expect(platform.cleanupRestoreCommit).toHaveBeenCalledTimes(1);
  expect(artifact.remove).not.toHaveBeenCalled();
  expect(runtime.getGeneration()).toBe(0);
  await expect(runtime.runOperation(async () => undefined)).resolves.toBeUndefined();
});

test('rolls back a valid database whose row values differ despite matching counts', async () => {
  const runtime = runtimeWithConnections(3);
  const platform = fakePlatform();
  const differentRows = { ...restored, semanticDigest: '3'.repeat(64) };
  jest.mocked(inspectDatabase)
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(differentRows)
    .mockResolvedValueOnce(original);
  await runtime.start();
  runtime.subscribe(() => runtime.confirmGeneration(runtime.getGeneration()));

  await expect(commitPreparedRestore(runtime, platform, fakeArtifact(), restored)).rejects.toMatchObject({
    code: 'unchanged',
  });

  expect(platform.activateRollback).toHaveBeenCalledTimes(1);
});

test.each([
  'restore.original-validation',
  'restore.rollback-create',
  'restore.rollback-verify',
  'restore.marker-rollback-ready',
] as const)('keeps the original database when failure is injected at %s', async (stage) => {
  const runtime = runtimeWithConnections(1);
  const platform = fakePlatform();
  jest.mocked(inspectDatabase).mockResolvedValue(original);
  await runtime.start();

  await expect(commitPreparedRestore(runtime, platform, fakeArtifact(), restored, async (current, timing) => {
    if (current === stage && timing === 'before') throw new Error(`injected:${stage}`);
  })).rejects.toMatchObject({ code: 'unchanged' });

  expect(platform.activateDatabase).not.toHaveBeenCalled();
  expect(platform.activateRollback).not.toHaveBeenCalled();
  await expect(runtime.runOperation(async () => undefined)).resolves.toBeUndefined();
});

test.each(['restore.application-remount', 'restore.cleanup'] as const)(
  'preserves a verified replacement for startup recovery when %s fails',
  async (stage) => {
    const runtime = runtimeWithConnections(2);
    const platform = fakePlatform();
    const artifact = fakeArtifact();
    jest.mocked(inspectDatabase).mockResolvedValueOnce(original).mockResolvedValueOnce(restored);
    await runtime.start();
    runtime.subscribe(() => runtime.confirmGeneration(runtime.getGeneration()));

    await expect(commitPreparedRestore(runtime, platform, artifact, restored, async (current, timing) => {
      if (current === stage && timing === 'before') throw new Error(`injected:${stage}`);
    })).rejects.toMatchObject({ code: 'unrecoverable' });

    expect(platform.activateRollback).not.toHaveBeenCalled();
    expect(platform.writeRestoreMarker).toHaveBeenLastCalledWith(
      'replacement-verified', rollback, restored,
    );
    if (stage === 'restore.cleanup') {
      expect(platform.cleanupRestoreCommit).toHaveBeenCalledTimes(1);
      expect(artifact.remove).toHaveBeenCalledTimes(1);
    } else {
      expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
    }
  },
);

test('enters safe stop when rollback re-verification fails after replacement starts', async () => {
  const runtime = runtimeWithConnections(2);
  const platform = fakePlatform();
  const generationPublished = jest.fn();
  jest.mocked(inspectDatabase)
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new Error('candidate is invalid'));
  await runtime.start();
  runtime.subscribe(generationPublished);

  await expect(commitPreparedRestore(runtime, platform, fakeArtifact(), restored, async (stage, timing) => {
    if (stage === 'restore.rollback-reverify' && timing === 'before') {
      throw new Error('rollback cannot be proven');
    }
  })).rejects.toMatchObject({ code: 'unrecoverable' });

  expect(platform.activateDatabase).toHaveBeenCalledTimes(1);
  expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
  expect(runtime.getGeneration()).toBe(0);
  expect(generationPublished).not.toHaveBeenCalled();
});

test.each([
  'restore.marker-replacement-started',
  'restore.replacement',
  'restore.active-validation',
  'restore.marker-replacement-verified',
] as const)('produces only verified original data when failure is injected after replacement starts at %s', async (stage) => {
  const runtime = runtimeWithConnections(3);
  const platform = fakePlatform();
  if (stage === 'restore.active-validation' || stage === 'restore.marker-replacement-verified') {
    jest.mocked(inspectDatabase).mockResolvedValueOnce(original).mockResolvedValueOnce(restored).mockResolvedValue(original);
  } else {
    jest.mocked(inspectDatabase).mockResolvedValue(original);
  }
  await runtime.start();

  await expect(commitPreparedRestore(runtime, platform, fakeArtifact(), restored, async (current, timing) => {
    if (current === stage && timing === 'after') throw new Error(`injected:${stage}`);
  })).rejects.toMatchObject({ code: 'unchanged' });

  expect(platform.activateRollback).toHaveBeenCalledTimes(1);
  await expect(runtime.runOperation(async () => undefined)).resolves.toBeUndefined();
});

test('preserves recovery state when both activation and rollback fail', async () => {
  const runtime = runtimeWithConnections(1);
  const platform = fakePlatform();
  jest.mocked(platform.activateDatabase).mockRejectedValue(new Error('replacement failed'));
  jest.mocked(platform.activateRollback).mockRejectedValue(new Error('rollback failed'));
  jest.mocked(inspectDatabase).mockResolvedValueOnce(original);
  await runtime.start();

  await expect(commitPreparedRestore(runtime, platform, fakeArtifact(), restored)).rejects.toMatchObject({
    code: 'unrecoverable',
  });

  expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
  await expect(runtime.runOperation(async () => undefined)).rejects.toThrow('Database is not available');
});

function runtimeWithConnections(count: number): DatabaseRuntime {
  const databases = Array.from({ length: count }, fakeDatabase);
  return new DatabaseRuntime(jest.fn(async () => {
    const database = databases.shift();
    if (!database) throw new Error('no database connection');
    return database;
  }));
}

function fakePlatform(): RestoreCommitPlatform {
  return {
    createRollbackSnapshot: jest.fn(async () => rollback),
    verifyRollbackSnapshot: jest.fn(async () => original),
    writeRestoreMarker: jest.fn(async () => undefined),
    activateDatabase: jest.fn(async () => undefined),
    activateRollback: jest.fn(async () => undefined),
    cleanupRestoreCommit: jest.fn(),
  };
}

function fakeArtifact(): BackupArtifact {
  return {
    uri: 'private://staged.sqlite',
    size: 1,
    read: jest.fn(async () => Uint8Array.of(1)),
    async *open() { yield Uint8Array.of(1); },
    sink: jest.fn(),
    remove: jest.fn(),
  } as unknown as BackupArtifact;
}

function fakeDatabase(): Database {
  return {
    closeAsync: jest.fn(async () => undefined),
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
  };
}
