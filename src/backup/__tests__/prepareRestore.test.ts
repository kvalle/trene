import { inspectDatabase } from '../../database/inspectDatabase';
import type { Database } from '../../database/types';
import { createBackupPackage } from '../packageCodec';
import {
  prepareRestore,
  RestorePreparationError,
  type RestorePlatform,
} from '../prepareRestore';
import type { BackupArtifact } from '../createBackup';
import type { BackupByteSink, BackupByteSource } from '../types';

jest.mock('../../database/inspectDatabase', () => ({ inspectDatabase: jest.fn() }));

const mockedInspectDatabase = jest.mocked(inspectDatabase);
const manifestCounts = { exercises: 2, workouts: 1, workout_exercises: 2, workout_sets: 3 };
const databaseInspection = {
  schemaVersion: 1,
  tableCounts: manifestCounts,
  previewCounts: { exercises: 7, workouts: 5 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedInspectDatabase.mockResolvedValue(databaseInspection);
});

test('treats picker cancellation as a no-op', async () => {
  const platform = fakePlatform(null);

  await expect(prepareRestore(platform)).resolves.toEqual({ status: 'cancelled' });
  expect(platform.createArtifact).not.toHaveBeenCalled();
  expect(platform.openDatabase).not.toHaveBeenCalled();
});

test('validates a privately staged package and returns database-derived preview counts', async () => {
  const packageArtifact = await validPackage();
  const platform = fakePlatform(packageArtifact);

  const result = await prepareRestore(platform);

  expect(result).toMatchObject({
    status: 'ready',
    restore: {
      createdAt: '2026-08-14T12:00:00.000Z',
      sourceSchemaVersion: 1,
      schemaVersion: 1,
      previewCounts: { exercises: 7, workouts: 5 },
    },
  });
  expect(platform.openDatabase).toHaveBeenCalledTimes(1);
  expect(packageArtifact.removed).toBe(true);
  const databaseArtifact = jest.mocked(platform.createArtifact).mock.results[0]!.value as MemoryArtifact;
  expect(databaseArtifact.removed).toBe(false);
  if (result.status === 'ready') result.restore.cancel();
  expect(databaseArtifact.removed).toBe(true);
});

test('rejects manifest counts that differ from the validated database and cleans staging', async () => {
  mockedInspectDatabase.mockResolvedValue({
    ...databaseInspection,
    tableCounts: { ...manifestCounts, workouts: 2 },
  });
  const packageArtifact = await validPackage();
  const platform = fakePlatform(packageArtifact);

  await expect(prepareRestore(platform)).rejects.toEqual(new RestorePreparationError('damaged-backup'));

  expect(packageArtifact.removed).toBe(true);
  const databaseArtifact = jest.mocked(platform.createArtifact).mock.results[0]!.value as MemoryArtifact;
  expect(databaseArtifact.removed).toBe(true);
});

test('rejects a newer schema with update guidance before opening SQLite', async () => {
  const packageArtifact = await validPackage(2);
  const platform = fakePlatform(packageArtifact);

  await expect(prepareRestore(platform)).rejects.toEqual(new RestorePreparationError('update-required'));
  expect(platform.openDatabase).not.toHaveBeenCalled();
});

test('closes SQLite and removes every artifact when inspection fails', async () => {
  mockedInspectDatabase.mockRejectedValue(new Error('invalid data'));
  const packageArtifact = await validPackage();
  const closeAsync = jest.fn(async () => undefined);
  const platform = fakePlatform(packageArtifact, { closeAsync } as unknown as Database);

  await expect(prepareRestore(platform)).rejects.toEqual(new RestorePreparationError('damaged-backup'));

  expect(closeAsync).toHaveBeenCalled();
  expect(packageArtifact.removed).toBe(true);
  expect((jest.mocked(platform.createArtifact).mock.results[0]!.value as MemoryArtifact).removed).toBe(true);
});

test('maps storage exhaustion to actionable guidance and cleans partial staging', async () => {
  const packageArtifact = await validPackage();
  const platform = fakePlatform(packageArtifact);
  jest.mocked(platform.createArtifact).mockImplementation(() => { throw new Error('ENOSPC: no space left'); });

  await expect(prepareRestore(platform)).rejects.toEqual(new RestorePreparationError('insufficient-storage'));
  expect(packageArtifact.removed).toBe(true);
});

async function validPackage(schemaVersion = 1): Promise<MemoryArtifact> {
  const artifact = new MemoryArtifact('private://selected.trene-backup');
  const database: BackupByteSource = {
    size: 4,
    async *open() { yield Uint8Array.of(1, 2, 3, 4); },
  };
  await createBackupPackage({
    appVersion: '1.0.0',
    createdAt: '2026-08-14T12:00:00.000Z',
    database,
    schemaVersion,
    tableCounts: manifestCounts,
  }, artifact.sink());
  return artifact;
}

function fakePlatform(packageArtifact: BackupArtifact | null, database: Database = fakeDatabase()): RestorePlatform {
  return {
    pickAndStagePackage: jest.fn(async () => packageArtifact),
    createArtifact: jest.fn((name) => new MemoryArtifact(`private://${name}`)),
    openDatabase: jest.fn(async () => database),
    availableBytes: jest.fn(() => Number.MAX_SAFE_INTEGER),
  };
}

class MemoryArtifact implements BackupArtifact {
  bytes = new Uint8Array();
  removed = false;
  constructor(readonly uri: string) {}
  get size() { return this.bytes.length; }
  async read(offset: number, length: number) { return this.bytes.slice(offset, offset + length); }
  async *open() { yield this.bytes; }
  sink(): BackupByteSink {
    this.bytes = new Uint8Array();
    return {
      write: async (chunk) => {
        const bytes = new Uint8Array(this.bytes.length + chunk.length);
        bytes.set(this.bytes);
        bytes.set(chunk, this.bytes.length);
        this.bytes = bytes;
      },
      close: async () => undefined,
      abort: async () => { this.bytes = new Uint8Array(); },
    };
  }
  remove() { this.removed = true; this.bytes = new Uint8Array(); }
}

function fakeDatabase(): Database {
  return {
    closeAsync: jest.fn(async () => undefined),
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
  };
}
