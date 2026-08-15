import { File } from 'expo-file-system';

import {
  nativeRestoreAvailableBytes,
  nativeRestoreFaultCheckpoint,
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
  await expect(nativeRestoreFaultCheckpoint('restore.active-validation', 'before')).resolves.toBeUndefined();
  expect(mockedFile).not.toHaveBeenCalled();
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
  }) as File);

  expect(nativeRestoreAvailableBytes(123)).toBe(bytes);
  if (failingStage) {
    await expect(nativeRestoreFaultCheckpoint(failingStage, 'before')).rejects.toThrow(/Injected simulator/u);
  }
  await expect(nativeRestoreFaultCheckpoint('restore.package-validation', 'before')).resolves.toBeUndefined();
  await expect(nativeRestoreFaultCheckpoint('restore.active-validation', 'after')).resolves.toBeUndefined();
});
