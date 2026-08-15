import type { DatabaseInspection } from '../database/inspectDatabase';
import type { RestoreMarker, RollbackSnapshot } from './commitRestore';
import { requireMatchingInspection } from './commitRestore';

export interface RestoreRecoveryPlatform {
  readRestoreMarker(): Promise<RestoreMarker | null>;
  inspectActiveDatabase(): Promise<DatabaseInspection>;
  verifyRollbackSnapshot(snapshot: RollbackSnapshot): Promise<DatabaseInspection>;
  activateRollback(): Promise<void>;
  cleanupRestoreCommit(): void;
}

export class RestoreSafeStopError extends Error {
  constructor(public readonly technicalCause: unknown) {
    super('Restore recovery could not verify either database');
    this.name = 'RestoreSafeStopError';
  }
}

export async function recoverInterruptedRestore(
  platform: RestoreRecoveryPlatform,
): Promise<null | (() => void)> {
  let marker: RestoreMarker | null;
  try {
    marker = await platform.readRestoreMarker();
  } catch (error) {
    throw new RestoreSafeStopError(error);
  }
  if (!marker) return null;

  const expectedActive = marker.stage === 'rollback-ready'
    ? inspectionFromSnapshot(marker.rollback)
    : marker.restored;
  let activeError: unknown;
  try {
    const active = await platform.inspectActiveDatabase();
    requireMatchingInspection(active, expectedActive);
    return platform.cleanupRestoreCommit;
  } catch (error) {
    activeError = error;
    // Replacement was incomplete or invalid; recover the verified original below.
  }

  try {
    const rollback = await platform.verifyRollbackSnapshot(marker.rollback);
    requireMatchingInspection(rollback, inspectionFromSnapshot(marker.rollback));
    await platform.activateRollback();
    const active = await platform.inspectActiveDatabase();
    requireMatchingInspection(active, rollback);
    return platform.cleanupRestoreCommit;
  } catch (error) {
    throw new RestoreSafeStopError({ activeError, rollbackError: error });
  }
}

function inspectionFromSnapshot(snapshot: RollbackSnapshot): DatabaseInspection {
  return {
    schemaVersion: snapshot.schemaVersion,
    tableCounts: snapshot.tableCounts,
    previewCounts: {
      exercises: snapshot.tableCounts.exercises,
      workouts: snapshot.tableCounts.workouts,
    },
  };
}
