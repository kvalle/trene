import { File } from 'expo-file-system';

import {
  nativeRestoreAvailableBytes,
  nativeBackupRestoreFaultCheckpoint,
  preserveAutomationBackup,
} from '../nativeRestoreAutomation';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { document: 'file:///documents' },
}));

const mockedFile = jest.mocked(File);
const originalAutomation = process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION;

afterEach(() => {
  process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION = originalAutomation;
  mockedFile.mockReset();
});

test('does not read or inject automation scenarios in normal builds', async () => {
  delete process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION;

  expect(nativeRestoreAvailableBytes(123)).toBe(123);
  await expect(nativeBackupRestoreFaultCheckpoint('restore.active-validation', 'before')).resolves.toBeUndefined();
  expect(mockedFile).not.toHaveBeenCalled();
});

test('preserves a runtime-created backup only in automation builds', async () => {
  const copy = jest.fn();
  mockedFile.mockImplementation((...parts: unknown[]) => ({ copy, parts }) as unknown as File);

  delete process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION;
  await preserveAutomationBackup('file:///cache/export.trene-backup');
  expect(copy).not.toHaveBeenCalled();

  process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION = '1';
  await preserveAutomationBackup('file:///cache/export.trene-backup');
  expect(copy).toHaveBeenCalledWith(
    expect.objectContaining({ parts: ['file:///documents', 'trene-automation-export.trene-backup'] }),
    { overwrite: true },
  );
});

test.each([
  ['storage-failure', 0, null],
  ['restore-failure', 123, 'restore.active-validation'],
  ['rollback-failure', 123, 'restore.rollback-activate'],
] as const)('enables the bounded %s simulator scenario', async (scenario, bytes, failingStage) => {
  process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION = '1';
  mockedFile.mockImplementation(() => ({
    exists: true,
    textSync: () => scenario,
  }) as unknown as File);

  expect(nativeRestoreAvailableBytes(123)).toBe(bytes);
  if (failingStage) {
    await expect(nativeBackupRestoreFaultCheckpoint(failingStage, 'before')).rejects.toThrow(/Injected simulator/u);
  }
  await expect(nativeBackupRestoreFaultCheckpoint('restore.package-validation', 'before')).resolves.toBeUndefined();
  await expect(nativeBackupRestoreFaultCheckpoint('restore.active-validation', 'after')).resolves.toBeUndefined();
});

test('publishes a deterministic interruption checkpoint', async () => {
  process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION = '1';
  const write = jest.fn();
  mockedFile.mockImplementation((_parent, name) => ({
    exists: name === 'trene-automation-scenario.txt',
    textSync: () => 'interrupt:restore.replacement:before',
    write,
  }) as unknown as File);

  void nativeBackupRestoreFaultCheckpoint('restore.replacement', 'before');
  await Promise.resolve();

  expect(write).toHaveBeenCalledWith('restore.replacement:before');
});
