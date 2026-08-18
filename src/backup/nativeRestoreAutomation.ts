import { File, Paths } from 'expo-file-system';

import {
  BACKUP_RESTORE_STAGES,
  type BackupRestoreStage,
  type FaultCheckpoint,
  type FaultTiming,
} from './faultInjection';

type AutomationScenario = 'storage-failure' | 'restore-failure' | 'rollback-failure';

const SCENARIO_FILE = 'trene-automation-scenario.txt';
const CHECKPOINT_FILE = 'trene-automation-checkpoint.txt';

export function nativeRestoreAvailableBytes(availableBytes: number): number {
  return readScenario() === 'storage-failure' ? 0 : availableBytes;
}

export const nativeBackupRestoreFaultCheckpoint: FaultCheckpoint = async (stage, timing) => {
  const interruption = readInterruption();
  if (interruption?.stage === stage && interruption.timing === timing) {
    new File(Paths.document, CHECKPOINT_FILE).write(`${stage}:${timing}`);
    await new Promise<never>(() => undefined);
  }
  if (timing !== 'before') return;
  const scenario = readScenario();
  if (scenario === 'restore-failure' && stage === 'restore.active-validation') {
    throw new Error('Injected simulator restore failure');
  }
  if (scenario === 'rollback-failure'
    && (stage === 'restore.active-validation'
      || stage === 'restore.rollback-activate'
      || stage === 'recovery.active-validation'
      || stage === 'recovery.rollback-activate')) {
    throw new Error('Injected simulator rollback failure');
  }
};

function readScenario(): AutomationScenario | null {
  if (process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION !== '1') return null;
  const file = new File(Paths.document, SCENARIO_FILE);
  if (!file.exists) return null;
  const scenario = file.textSync().trim();
  return ['storage-failure', 'restore-failure', 'rollback-failure'].includes(scenario)
    ? scenario as AutomationScenario
    : null;
}

function readInterruption(): { stage: BackupRestoreStage; timing: FaultTiming } | null {
  if (process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION !== '1') return null;
  const file = new File(Paths.document, SCENARIO_FILE);
  if (!file.exists) return null;
  const match = /^interrupt:(.+):(before|after)$/u.exec(file.textSync().trim());
  if (!match || !BACKUP_RESTORE_STAGES.includes(match[1] as BackupRestoreStage)) return null;
  return { stage: match[1] as BackupRestoreStage, timing: match[2] as FaultTiming };
}
