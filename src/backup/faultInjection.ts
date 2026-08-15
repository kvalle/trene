export const BACKUP_RESTORE_STAGES = [
  'backup.stage-artifacts',
  'backup.snapshot',
  'backup.snapshot-validation',
  'backup.package',
  'backup.package-validation',
  'backup.share',
  'backup.cleanup',
  'restore.package-staging',
  'restore.package-validation',
  'restore.source-validation',
  'restore.preparation-cleanup',
  'restore.original-validation',
  'restore.rollback-create',
  'restore.rollback-verify',
  'restore.rollback-reverify',
  'restore.marker-rollback-ready',
  'restore.marker-replacement-started',
  'restore.replacement',
  'restore.active-validation',
  'restore.marker-replacement-verified',
  'restore.application-remount',
  'restore.rollback-activate',
  'restore.rollback-validation',
  'restore.cleanup',
  'recovery.marker-read',
  'recovery.active-validation',
  'recovery.rollback-verify',
  'recovery.rollback-activate',
  'recovery.rollback-validation',
] as const;

export type BackupRestoreStage = typeof BACKUP_RESTORE_STAGES[number];
export type FaultTiming = 'before' | 'after';
export type FaultCheckpoint = (stage: BackupRestoreStage, timing: FaultTiming) => Promise<void>;

export async function atCheckpoint<T>(
  checkpoint: FaultCheckpoint | undefined,
  stage: BackupRestoreStage,
  operation: () => Promise<T>,
): Promise<T> {
  await checkpoint?.(stage, 'before');
  const result = await operation();
  await checkpoint?.(stage, 'after');
  return result;
}

export async function atCleanupCheckpoint(
  checkpoint: FaultCheckpoint | undefined,
  stage: BackupRestoreStage,
  cleanup: () => void,
): Promise<void> {
  let checkpointError: unknown;
  try {
    await checkpoint?.(stage, 'before');
  } catch (error) {
    checkpointError = error;
  }
  cleanup();
  if (checkpointError) throw checkpointError;
  await checkpoint?.(stage, 'after');
}
