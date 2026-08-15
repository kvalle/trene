import { sha256 } from '@noble/hashes/sha256';

import type { DatabaseMaintenance, DatabaseRuntime } from '../database/DatabaseRuntime';
import { inspectDatabase, type DatabaseInspection } from '../database/inspectDatabase';
import type { Database } from '../database/types';
import type { BackupArtifact } from './createBackup';

export interface RollbackSnapshot {
  size: number;
  sha256: string;
  schemaVersion: number;
  tableCounts: DatabaseInspection['tableCounts'];
}

export type RestoreMarkerStage = 'rollback-ready' | 'replacement-started' | 'replacement-verified';

export interface RestoreMarker {
  version: 1;
  stage: RestoreMarkerStage;
  rollback: RollbackSnapshot;
  restored: DatabaseInspection;
}

export interface RestoreCommitPlatform {
  createRollbackSnapshot(database: Database, inspection: DatabaseInspection): Promise<RollbackSnapshot>;
  verifyRollbackSnapshot(snapshot: RollbackSnapshot): Promise<DatabaseInspection>;
  writeRestoreMarker(
    stage: RestoreMarkerStage,
    snapshot: RollbackSnapshot,
    restored: DatabaseInspection,
  ): Promise<void>;
  activateDatabase(artifact: BackupArtifact): Promise<void>;
  activateRollback(): Promise<void>;
  cleanupRestoreCommit(): void;
}

export class RestoreCommitError extends Error {
  constructor(
    public readonly code: 'unchanged' | 'unrecoverable',
    public readonly technicalCause?: unknown,
  ) {
    super(code);
    this.name = 'RestoreCommitError';
  }
}

export async function inspectCurrentDatabase(runtime: DatabaseRuntime): Promise<DatabaseInspection> {
  return runtime.runOperation(inspectDatabase);
}

export async function commitPreparedRestore(
  runtime: DatabaseRuntime,
  platform: RestoreCommitPlatform,
  stagedDatabase: BackupArtifact,
  expected: DatabaseInspection,
): Promise<DatabaseInspection> {
  let replacementStarted = false;
  try {
    const restored = await runtime.runExclusive(async (maintenance) => {
      const original = await maintenance.run(inspectDatabase);
      const rollback = await maintenance.run((database) => platform.createRollbackSnapshot(database, original));
      const verifiedRollback = await platform.verifyRollbackSnapshot(rollback);
      requireMatchingInspection(verifiedRollback, original);
      await platform.writeRestoreMarker('rollback-ready', rollback, expected);

      try {
        await platform.writeRestoreMarker('replacement-started', rollback, expected);
        replacementStarted = true;
        await maintenance.replace(() => platform.activateDatabase(stagedDatabase));
        const active = await maintenance.run(inspectDatabase);
        requireMatchingInspection(active, expected);
        await platform.writeRestoreMarker('replacement-verified', rollback, expected);
        return active;
      } catch (error) {
        if (!replacementStarted) throw error;
        return rollbackOriginal(maintenance, platform, rollback, original, error);
      }
    });
    await runtime.waitForGeneration(runtime.getGeneration());
    safeCleanup(platform, stagedDatabase);
    return restored;
  } catch (error) {
    if (error instanceof RestoreCommitError && error.code === 'unrecoverable') throw error;
    if (!replacementStarted || error instanceof RestoreCommitError) safeCleanup(platform);
    throw new RestoreCommitError('unchanged', error);
  }
}

async function rollbackOriginal(
  maintenance: DatabaseMaintenance,
  platform: RestoreCommitPlatform,
  rollback: RollbackSnapshot,
  original: DatabaseInspection,
  restoreError: unknown,
): Promise<never> {
  try {
    const verifiedSnapshot = await platform.verifyRollbackSnapshot(rollback);
    requireMatchingInspection(verifiedSnapshot, original);
    await maintenance.replace(() => platform.activateRollback(), false);
    const active = await maintenance.run(inspectDatabase);
    requireMatchingInspection(active, original);
    throw new RestoreCommitError('unchanged', restoreError);
  } catch (rollbackError) {
    if (rollbackError instanceof RestoreCommitError) throw rollbackError;
    throw new RestoreCommitError('unrecoverable', { restoreError, rollbackError });
  }
}

function safeCleanup(platform: RestoreCommitPlatform, stagedDatabase?: BackupArtifact): void {
  try {
    platform.cleanupRestoreCommit();
  } catch {
    // Startup cleanup can retry; verified data state determines the user-visible outcome.
  }
  try {
    stagedDatabase?.remove();
  } catch {
    // A retained staging file is harmless and can be removed on the next startup.
  }
}

export function digestBytes(bytes: Uint8Array): string {
  return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function requireMatchingInspection(actual: DatabaseInspection, expected: DatabaseInspection): void {
  if (
    actual.schemaVersion !== expected.schemaVersion
    || JSON.stringify(actual.tableCounts) !== JSON.stringify(expected.tableCounts)
    || JSON.stringify(actual.previewCounts) !== JSON.stringify(expected.previewCounts)
  ) {
    throw new Error('Restored database differs from the validated preparation');
  }
}
