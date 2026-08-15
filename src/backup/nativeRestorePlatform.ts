import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';

import { DATABASE_NAME } from '../database/openDatabase';
import { inspectDatabase, type DatabaseInspection } from '../database/inspectDatabase';
import type { BackupArtifact } from './createBackup';
import {
  digestBytes,
  type RestoreCommitPlatform,
  type RestoreMarker,
  type RollbackSnapshot,
  type RestoreMarkerStage,
} from './commitRestore';
import type { RestorePlatform } from './prepareRestore';
import type { RestoreRecoveryPlatform } from './recoverRestore';
import type { BackupByteSink } from './types';

const RESTORE_DIRECTORY = 'trene-restore-preparation';
const RECOVERY_DIRECTORY = 'trene-restore-recovery';
const ROLLBACK_NAME = 'rollback.sqlite';
const MARKER_NAME = 'operation.json';

export function createNativeRestorePlatform(): RestorePlatform {
  return {
    pickAndStagePackage: async () => {
      const picked = await File.pickFileAsync({
        mimeTypes: ['application/zip', 'application/octet-stream'],
        multipleFiles: false,
      });
      if (picked.canceled) return null;
      const artifact = createFileArtifact(`selected-${uniqueSuffix()}.trene-backup`);
      const destination = fileForArtifact(artifact);
      try {
        await picked.result.copy(destination);
        return artifact;
      } catch (error) {
        artifact.remove();
        throw error;
      }
    },
    createArtifact: createFileArtifact,
    openDatabase: async (artifact) => {
      const file = fileForArtifact(artifact);
      return openDatabaseAsync(file.name, { useNewConnection: true }, file.parentDirectory.uri);
    },
    availableBytes: () => Paths.availableDiskSpace,
    ...createNativeRestoreCommitPlatform(),
  };
}

function createNativeRestoreCommitPlatform(): RestoreCommitPlatform {
  return {
    createRollbackSnapshot: async (database, inspection) => {
      if (!database.serializeAsync) throw new Error('SQLite snapshot export is unavailable');
      const bytes = await database.serializeAsync();
      const file = rollbackFile();
      recoveryDirectory().create({ idempotent: true, intermediates: true });
      file.write(bytes);
      return {
        size: bytes.length,
        sha256: digestBytes(bytes),
        schemaVersion: inspection.schemaVersion,
        tableCounts: inspection.tableCounts,
        semanticDigest: inspection.semanticDigest,
      };
    },
    verifyRollbackSnapshot: async (snapshot) => inspectRollback(snapshot),
    writeRestoreMarker: async (stage, snapshot, restored) => writeMarker(stage, snapshot, restored),
    activateDatabase: async (artifact) => activate(fileForArtifact(artifact)),
    activateRollback: async () => activate(rollbackFile()),
    cleanupRestoreCommit: () => {
      const directory = recoveryDirectory();
      if (directory.exists) directory.delete();
    },
  };
}

export function createNativeRestoreRecoveryPlatform(): RestoreRecoveryPlatform {
  const commit = createNativeRestoreCommitPlatform();
  return {
    readRestoreMarker: readMarker,
    inspectActiveDatabase: inspectActiveDatabase,
    verifyRollbackSnapshot: commit.verifyRollbackSnapshot,
    activateRollback: commit.activateRollback,
    cleanupRestoreCommit: commit.cleanupRestoreCommit,
  };
}

export async function cleanupAbandonedRestorePreparations(): Promise<void> {
  const directory = restoreDirectory();
  if (!directory.exists) return;
  for (const entry of directory.list()) entry.delete();
}

async function inspectRollback(snapshot: RollbackSnapshot): Promise<DatabaseInspection> {
  const file = rollbackFile();
  if (!file.exists || file.size !== snapshot.size || digestBytes(await file.bytes()) !== snapshot.sha256) {
    throw new Error('Rollback snapshot metadata does not match');
  }
  const database = await openDatabaseAsync(file.name, { useNewConnection: true }, file.parentDirectory.uri);
  try {
    const inspection = await inspectDatabase(database);
    if (
      inspection.schemaVersion !== snapshot.schemaVersion
      || JSON.stringify(inspection.tableCounts) !== JSON.stringify(snapshot.tableCounts)
      || inspection.semanticDigest !== snapshot.semanticDigest
    ) throw new Error('Rollback snapshot inspection does not match');
    return inspection;
  } finally {
    await database.closeAsync();
  }
}

async function writeMarker(
  stage: RestoreMarkerStage,
  snapshot: RollbackSnapshot,
  restored: DatabaseInspection,
): Promise<void> {
  const directory = recoveryDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const pending = new File(directory, `${MARKER_NAME}.pending`);
  const marker = new File(directory, MARKER_NAME);
  pending.write(JSON.stringify({ version: 1, stage, rollback: snapshot, restored }));
  await pending.move(marker, { overwrite: true });
}

async function readMarker(): Promise<RestoreMarker | null> {
  const file = new File(recoveryDirectory(), MARKER_NAME);
  if (!file.exists) return null;
  const marker: unknown = JSON.parse(await file.text());
  if (!isRestoreMarker(marker)) throw new Error('Restore operation marker is invalid');
  return marker;
}

async function inspectActiveDatabase(): Promise<DatabaseInspection> {
  const database = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }, defaultDatabaseDirectory);
  try {
    return await inspectDatabase(database);
  } finally {
    await database.closeAsync();
  }
}

function isRestoreMarker(value: unknown): value is RestoreMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<RestoreMarker>;
  return marker.version === 1
    && ['rollback-ready', 'replacement-started', 'replacement-verified'].includes(marker.stage ?? '')
    && isInspection(marker.restored)
    && !!marker.rollback
    && typeof marker.rollback.size === 'number'
    && typeof marker.rollback.sha256 === 'string'
    && marker.rollback.sha256.length === 64
    && typeof marker.rollback.schemaVersion === 'number'
    && typeof marker.rollback.semanticDigest === 'string'
    && marker.rollback.semanticDigest.length === 64
    && isTableCounts(marker.rollback.tableCounts);
}

function isInspection(value: unknown): value is DatabaseInspection {
  if (!value || typeof value !== 'object') return false;
  const inspection = value as Partial<DatabaseInspection>;
  return typeof inspection.schemaVersion === 'number'
    && isTableCounts(inspection.tableCounts)
    && !!inspection.previewCounts
    && typeof inspection.previewCounts.exercises === 'number'
    && typeof inspection.previewCounts.workouts === 'number'
    && typeof inspection.semanticDigest === 'string'
    && inspection.semanticDigest.length === 64;
}

function isTableCounts(value: unknown): value is DatabaseInspection['tableCounts'] {
  if (!value || typeof value !== 'object') return false;
  const counts = value as Record<string, unknown>;
  return ['exercises', 'workouts', 'workout_exercises', 'workout_sets']
    .every((table) => typeof counts[table] === 'number');
}

async function activate(source: File): Promise<void> {
  const live = new File(defaultDatabaseDirectory, DATABASE_NAME);
  const pending = new File(defaultDatabaseDirectory, `${DATABASE_NAME}.restore`);
  await source.copy(pending, { overwrite: true });
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = new File(defaultDatabaseDirectory, `${DATABASE_NAME}${suffix}`);
    if (sidecar.exists) sidecar.delete();
  }
  await pending.move(live, { overwrite: true });
}

function createFileArtifact(name: string): BackupArtifact {
  const directory = restoreDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, name);
  if (file.exists) file.delete();
  const artifact: BackupArtifact = {
    get size() { return file.size; },
    uri: file.uri,
    async read(offset, length) {
      const handle = file.open(FileMode.ReadOnly);
      try {
        handle.offset = offset;
        return handle.readBytes(length);
      } finally {
        handle.close();
      }
    },
    async *open() {
      const handle = file.open(FileMode.ReadOnly);
      try {
        while ((handle.offset ?? 0) < (handle.size ?? 0)) {
          yield handle.readBytes(Math.min(64 * 1024, (handle.size ?? 0) - (handle.offset ?? 0)));
        }
      } finally {
        handle.close();
      }
    },
    sink: () => fileSink(file),
    remove: () => { if (file.exists) file.delete(); },
  };
  artifactFiles.set(artifact, file);
  return artifact;
}

const artifactFiles = new WeakMap<BackupArtifact, File>();

function fileForArtifact(artifact: BackupArtifact): File {
  const file = artifactFiles.get(artifact);
  if (!file) throw new Error('Restore artifact is not owned by this platform');
  return file;
}

function fileSink(file: File): BackupByteSink {
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  const handle = file.open(FileMode.WriteOnly);
  let open = true;
  return {
    write: async (chunk) => { if (!open) throw new Error('File sink is closed'); handle.writeBytes(chunk); },
    close: async () => { if (open) { open = false; handle.close(); } },
    abort: async () => {
      if (open) { open = false; handle.close(); }
      if (file.exists) file.delete();
    },
  };
}

function restoreDirectory(): Directory {
  return new Directory(Paths.cache, RESTORE_DIRECTORY);
}

function recoveryDirectory(): Directory {
  return new Directory(Paths.document, RECOVERY_DIRECTORY);
}

function rollbackFile(): File {
  return new File(recoveryDirectory(), ROLLBACK_NAME);
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
