import { SCHEMA_VERSION } from '../database/migrate';
import { inspectDatabase, type DatabaseInspection } from '../database/inspectDatabase';
import type { Database } from '../database/types';
import type { BackupArtifact } from './createBackup';
import { inspectBackupPackage } from './packageCodec';
import { BackupPackageError } from './types';

export type RestorePreparationErrorCode =
  | 'damaged-backup'
  | 'update-required'
  | 'insufficient-storage';

export class RestorePreparationError extends Error {
  constructor(
    public readonly code: RestorePreparationErrorCode,
    public readonly technicalCause?: unknown,
  ) {
    super(code);
    this.name = 'RestorePreparationError';
  }
}

export interface RestorePlatform {
  pickAndStagePackage(): Promise<BackupArtifact | null>;
  createArtifact(name: string): BackupArtifact;
  openDatabase(artifact: BackupArtifact): Promise<Database>;
  availableBytes(): number;
}

export interface PreparedRestore {
  createdAt: string;
  sourceSchemaVersion: number;
  schemaVersion: number;
  previewCounts: DatabaseInspection['previewCounts'];
  cancel(): void;
}

export type PrepareRestoreResult =
  | { status: 'cancelled' }
  | { status: 'ready'; restore: PreparedRestore };

export async function prepareRestore(platform: RestorePlatform): Promise<PrepareRestoreResult> {
  let packageArtifact: BackupArtifact | null = null;
  let databaseArtifact: BackupArtifact | null = null;
  let database: Database | null = null;
  let keepDatabase = false;

  try {
    packageArtifact = await platform.pickAndStagePackage();
    if (!packageArtifact) return { status: 'cancelled' };
    const availableBytes = platform.availableBytes();
    if (!Number.isSafeInteger(availableBytes) || availableBytes <= 0) {
      throw new RestorePreparationError('insufficient-storage');
    }

    databaseArtifact = platform.createArtifact(`restore-${uniqueSuffix()}.sqlite`);
    const packageInspection = await inspectBackupPackage(packageArtifact, {
      limits: {
        maxCompressedBytes: Math.max(1, packageArtifact.size),
        maxUncompressedBytes: availableBytes,
      },
      createComponentSink: async (path) => {
        if (path !== 'database.sqlite') throw new RestorePreparationError('damaged-backup');
        return databaseArtifact!.sink();
      },
    });
    if (packageInspection.status === 'update-required') {
      throw new RestorePreparationError('update-required');
    }
    const { manifest } = packageInspection;
    if (manifest.schemaVersion > SCHEMA_VERSION) throw new RestorePreparationError('update-required');
    if (manifest.schemaVersion !== SCHEMA_VERSION) throw new RestorePreparationError('damaged-backup');

    database = await platform.openDatabase(databaseArtifact);
    const inspection = await inspectDatabase(database);
    if (
      inspection.schemaVersion !== manifest.schemaVersion
      || Object.entries(inspection.tableCounts).some(([table, count]) => manifest.tableCounts[table] !== count)
    ) {
      throw new RestorePreparationError('damaged-backup');
    }
    await database.closeAsync();
    database = null;
    keepDatabase = true;
    const retainedArtifact = databaseArtifact;
    return {
      status: 'ready',
      restore: {
        createdAt: manifest.createdAt,
        sourceSchemaVersion: manifest.schemaVersion,
        schemaVersion: inspection.schemaVersion,
        previewCounts: inspection.previewCounts,
        cancel: () => removeArtifact(retainedArtifact),
      },
    };
  } catch (error) {
    if (error instanceof RestorePreparationError) throw error;
    if (error instanceof BackupPackageError && error.code === 'unsupported-component') {
      throw new RestorePreparationError('update-required', error);
    }
    if (isStorageError(error)) throw new RestorePreparationError('insufficient-storage', error);
    throw new RestorePreparationError('damaged-backup', error);
  } finally {
    if (database) await database.closeAsync().catch(() => undefined);
    removeArtifact(packageArtifact);
    if (!keepDatabase) removeArtifact(databaseArtifact);
  }
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStorageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOSPC|disk full|no space|not enough space|insufficient storage/iu.test(message);
}

function removeArtifact(artifact: BackupArtifact | null): void {
  try {
    artifact?.remove();
  } catch {
    // Startup cleanup gets another chance; never replace the primary outcome.
  }
}
