import type { DatabaseInspection } from '../../database/inspectDatabase';
import type { RestoreMarker } from '../commitRestore';
import {
  recoverInterruptedRestore,
  RestoreSafeStopError,
  type RestoreRecoveryPlatform,
} from '../recoverRestore';

const original: DatabaseInspection = {
  schemaVersion: 1,
  tableCounts: { exercises: 2, workouts: 1, workout_exercises: 1, workout_sets: 2 },
  previewCounts: { exercises: 2, workouts: 1 },
  semanticDigest: '1'.repeat(64),
};
const restored: DatabaseInspection = {
  schemaVersion: 1,
  tableCounts: { exercises: 4, workouts: 3, workout_exercises: 5, workout_sets: 8 },
  previewCounts: { exercises: 4, workouts: 3 },
  semanticDigest: '2'.repeat(64),
};

test('does nothing without an interrupted restore', async () => {
  const platform = fakePlatform(null);
  await expect(recoverInterruptedRestore(platform)).resolves.toBeNull();
  expect(platform.inspectActiveDatabase).not.toHaveBeenCalled();
});

test.each(['replacement-started', 'replacement-verified'] as const)(
  'accepts a verified restored database at %s and defers cleanup',
  async (stage) => {
    const platform = fakePlatform(marker(stage));
    jest.mocked(platform.inspectActiveDatabase).mockResolvedValue(restored);

    const cleanup = await recoverInterruptedRestore(platform);

    expect(platform.activateRollback).not.toHaveBeenCalled();
    expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
    cleanup?.();
    expect(platform.cleanupRestoreCommit).toHaveBeenCalledTimes(1);
  },
);

test.each(['rollback-ready', 'replacement-started', 'replacement-verified'] as const)(
  'restores and validates the original database when the active database is invalid at %s',
  async (stage) => {
    const platform = fakePlatform(marker(stage));
    jest.mocked(platform.inspectActiveDatabase)
      .mockRejectedValueOnce(new Error('active invalid'))
      .mockResolvedValueOnce(original);

    await expect(recoverInterruptedRestore(platform)).resolves.toEqual(platform.cleanupRestoreCommit);
    expect(platform.activateRollback).toHaveBeenCalledTimes(1);
  },
);

test('accepts the verified original before replacement without activating rollback', async () => {
  const platform = fakePlatform(marker('rollback-ready'));
  jest.mocked(platform.inspectActiveDatabase).mockResolvedValue(original);

  await expect(recoverInterruptedRestore(platform)).resolves.toEqual(platform.cleanupRestoreCommit);
  expect(platform.activateRollback).not.toHaveBeenCalled();
});

test('accepts the verified original when replacement may not have started', async () => {
  const platform = fakePlatform(marker('replacement-started'));
  jest.mocked(platform.inspectActiveDatabase).mockResolvedValue(original);

  await expect(recoverInterruptedRestore(platform)).resolves.toEqual(platform.cleanupRestoreCommit);
  expect(platform.verifyRollbackSnapshot).not.toHaveBeenCalled();
  expect(platform.activateRollback).not.toHaveBeenCalled();
});

test('repeats recovery on restart until deferred cleanup completes', async () => {
  const platform = fakePlatform(marker('replacement-verified'));
  jest.mocked(platform.inspectActiveDatabase).mockResolvedValue(restored);

  await recoverInterruptedRestore(platform);
  await recoverInterruptedRestore(platform);

  expect(platform.readRestoreMarker).toHaveBeenCalledTimes(2);
  expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
});

test('enters safe stop and preserves artifacts when restore and rollback are invalid', async () => {
  const platform = fakePlatform(marker('replacement-started'));
  const activeError = new Error('active invalid');
  const rollbackError = new Error('rollback failed');
  jest.mocked(platform.inspectActiveDatabase).mockRejectedValue(activeError);
  jest.mocked(platform.activateRollback).mockRejectedValue(rollbackError);

  await expect(recoverInterruptedRestore(platform)).rejects.toMatchObject({
    technicalCause: { activeError, rollbackError },
  });
  expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
});

test('rejects restored data with matching counts but different semantic values', async () => {
  const platform = fakePlatform(marker('replacement-started'));
  jest.mocked(platform.inspectActiveDatabase)
    .mockResolvedValueOnce({ ...restored, semanticDigest: '3'.repeat(64) })
    .mockResolvedValueOnce(original);

  await expect(recoverInterruptedRestore(platform)).resolves.toEqual(platform.cleanupRestoreCommit);
  expect(platform.activateRollback).toHaveBeenCalledTimes(1);
});

test.each([
  'recovery.marker-read',
  'recovery.active-validation',
  'recovery.rollback-verify',
  'recovery.rollback-activate',
  'recovery.rollback-validation',
] as const)('enters safe stop without cleanup when failure is injected at %s', async (stage) => {
  const platform = fakePlatform(marker('replacement-started'));
  jest.mocked(platform.inspectActiveDatabase).mockRejectedValue(new Error('active invalid'));

  await expect(recoverInterruptedRestore(platform, async (current, timing) => {
    if (current === stage && timing === 'before') throw new Error(`injected:${stage}`);
  })).rejects.toBeInstanceOf(RestoreSafeStopError);

  expect(platform.cleanupRestoreCommit).not.toHaveBeenCalled();
});

test('durable marker contains safe versions, counts, stages, and digests without user content', () => {
  const serialized = JSON.stringify(marker('replacement-started'));

  expect(serialized).toContain('replacement-started');
  expect(serialized).toContain('semanticDigest');
  expect(serialized).not.toMatch(/exercise name|SELECT |SQLite format|private:\/\//iu);
});

function marker(stage: RestoreMarker['stage']): RestoreMarker {
  return {
    version: 1,
    stage,
    rollback: {
      size: 1024,
      sha256: 'a'.repeat(64),
      schemaVersion: original.schemaVersion,
      tableCounts: original.tableCounts,
      semanticDigest: original.semanticDigest,
    },
    restored,
  };
}

function fakePlatform(value: RestoreMarker | null): RestoreRecoveryPlatform {
  return {
    readRestoreMarker: jest.fn(async () => value),
    inspectActiveDatabase: jest.fn(async () => restored),
    verifyRollbackSnapshot: jest.fn(async () => original),
    activateRollback: jest.fn(async () => undefined),
    cleanupRestoreCommit: jest.fn(),
  };
}
