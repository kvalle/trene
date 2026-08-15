import { sha256 } from '@noble/hashes/sha256';

import type { DatabaseMaintenance, DatabaseRuntime } from '../database/DatabaseRuntime';
import { inspectDatabase, type DatabaseInspection } from '../database/inspectDatabase';
import type { Database } from '../database/types';
import type { BackupArtifact } from './createBackup';
import { atCheckpoint, atCleanupCheckpoint, type FaultCheckpoint } from './faultInjection';

export interface RollbackSnapshot {
  size: number;
  sha256: string;
  schemaVersion: number;
  tableCounts: DatabaseInspection['tableCounts'];
  semanticDigest: string;
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
  checkpoint?: FaultCheckpoint,
): Promise<DatabaseInspection> {
  let replacementStarted = false;
  let replacementVerified = false;
  try {
    const restored = await runtime.runExclusive(async (maintenance) => {
      const original = await atCheckpoint(checkpoint, 'restore.original-validation', () => maintenance.run(inspectDatabase));
      const rollback = await atCheckpoint(checkpoint, 'restore.rollback-create', () => (
        maintenance.run((database) => platform.createRollbackSnapshot(database, original))
      ));
      const verifiedRollback = await atCheckpoint(checkpoint, 'restore.rollback-verify', () => platform.verifyRollbackSnapshot(rollback));
      requireMatchingInspection(verifiedRollback, original);
      await atCheckpoint(checkpoint, 'restore.marker-rollback-ready', () => (
        platform.writeRestoreMarker('rollback-ready', rollback, expected)
      ));

      try {
        replacementStarted = true;
        await atCheckpoint(checkpoint, 'restore.marker-replacement-started', () => (
          platform.writeRestoreMarker('replacement-started', rollback, expected)
        ));
        await atCheckpoint(checkpoint, 'restore.replacement', () => (
          maintenance.replace(() => platform.activateDatabase(stagedDatabase))
        ));
        const active = await atCheckpoint(checkpoint, 'restore.active-validation', () => maintenance.run(inspectDatabase));
        requireMatchingInspection(active, expected);
        await atCheckpoint(checkpoint, 'restore.marker-replacement-verified', () => (
          platform.writeRestoreMarker('replacement-verified', rollback, expected)
        ));
        replacementVerified = true;
        return active;
      } catch (error) {
        if (!replacementStarted) throw error;
        return rollbackOriginal(maintenance, platform, rollback, original, error, checkpoint);
      }
    });
    await atCheckpoint(checkpoint, 'restore.application-remount', () => runtime.waitForGeneration(runtime.getGeneration()));
    await atCleanupCheckpoint(checkpoint, 'restore.cleanup', () => safeCleanup(platform, stagedDatabase));
    return restored;
  } catch (error) {
    if (error instanceof RestoreCommitError && error.code === 'unrecoverable') throw error;
    if (replacementVerified) throw new RestoreCommitError('unrecoverable', error);
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
  checkpoint?: FaultCheckpoint,
): Promise<never> {
  try {
    const verifiedSnapshot = await atCheckpoint(checkpoint, 'restore.rollback-reverify', () => platform.verifyRollbackSnapshot(rollback));
    requireMatchingInspection(verifiedSnapshot, original);
    await atCheckpoint(checkpoint, 'restore.rollback-activate', () => maintenance.replace(() => platform.activateRollback(), false));
    const active = await atCheckpoint(checkpoint, 'restore.rollback-validation', () => maintenance.run(inspectDatabase));
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
    || actual.semanticDigest !== expected.semanticDigest
  ) {
    throw new Error('Restored database differs from the validated preparation');
  }
}
