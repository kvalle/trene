import { File, Paths } from 'expo-file-system';

import type { FaultCheckpoint } from './faultInjection';

type AutomationScenario = 'storage-failure' | 'restore-failure' | 'rollback-failure';

const SCENARIO_FILE = 'trene-automation-scenario.txt';

export function nativeRestoreAvailableBytes(availableBytes: number): number {
  return readScenario() === 'storage-failure' ? 0 : availableBytes;
}

export const nativeRestoreFaultCheckpoint: FaultCheckpoint = async (stage, timing) => {
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
