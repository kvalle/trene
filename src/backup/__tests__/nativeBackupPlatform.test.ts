import { createNativeBackupPlatform } from '../nativeBackupPlatform';
import { inspectDatabase } from '../../database/inspectDatabase';
import { deserializeDatabaseAsync } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import type { BackupByteSource } from '../types';
import type { Database } from '../../database/types';

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-sqlite', () => ({ deserializeDatabaseAsync: jest.fn() }));
jest.mock('../../database/inspectDatabase', () => ({ inspectDatabase: jest.fn() }));

const mockedDeserialize = jest.mocked(deserializeDatabaseAsync);
const mockedInspect = jest.mocked(inspectDatabase);

beforeEach(() => jest.clearAllMocks());

test.each(['android', 'ios'])('shares the validated file through the %s native boundary', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  const platform = createNativeBackupPlatform();

  await platform.share('file:///private/trene.trene-backup');

  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///private/trene.trene-backup', {
    dialogTitle: 'Del sikkerhetskopi',
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
  });
});

test('rejects sharing when the platform boundary is unavailable', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

  await expect(createNativeBackupPlatform().share('file:///backup')).rejects.toThrow('File sharing is unavailable');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('deserializes, fully inspects, and closes a snapshot', async () => {
  const database = { closeAsync: jest.fn() } as unknown as Database;
  mockedDeserialize.mockResolvedValue(database as never);
  mockedInspect.mockResolvedValue({ schemaVersion: 1 } as never);
  const source: BackupByteSource = {
    size: 3,
    async *open() { yield Uint8Array.of(1); yield Uint8Array.of(2, 3); },
  };

  await expect(createNativeBackupPlatform().inspectSnapshot(source)).resolves.toEqual({ schemaVersion: 1 });
  expect(mockedDeserialize).toHaveBeenCalledWith(Uint8Array.of(1, 2, 3));
  expect(mockedInspect).toHaveBeenCalledWith(database);
  expect(database.closeAsync).toHaveBeenCalled();
});

test('requires SQLite serialization instead of copying the live database file', async () => {
  const serializeAsync = jest.fn(async () => Uint8Array.of(1, 2));

  await expect(createNativeBackupPlatform().serializeSnapshot({ serializeAsync } as unknown as Database))
    .resolves.toEqual(Uint8Array.of(1, 2));
  expect(serializeAsync).toHaveBeenCalledWith();
});
