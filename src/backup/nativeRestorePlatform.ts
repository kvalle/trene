import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';

import type { BackupArtifact } from './createBackup';
import type { RestorePlatform } from './prepareRestore';
import type { BackupByteSink } from './types';

const RESTORE_DIRECTORY = 'trene-restore-preparation';

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
  };
}

export async function cleanupAbandonedRestorePreparations(): Promise<void> {
  const directory = restoreDirectory();
  if (!directory.exists) return;
  for (const entry of directory.list()) entry.delete();
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

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
