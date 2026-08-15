import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { deserializeDatabaseAsync } from 'expo-sqlite';

import { inspectDatabase } from '../database/inspectDatabase';
import type { Database } from '../database/types';
import type { BackupArtifact, BackupPlatform } from './createBackup';
import type { BackupByteSink } from './types';

const EXPORT_DIRECTORY = 'trene-exports';

export function createNativeBackupPlatform(): BackupPlatform {
  return {
    createArtifact: createFileArtifact,
    inspectSnapshot: async (source) => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of source.open()) chunks.push(chunk);
      const database = await deserializeDatabaseAsync(join(chunks));
      try {
        return await inspectDatabase(database);
      } finally {
        await database.closeAsync();
      }
    },
    serializeSnapshot: async (database: Database) => {
      if (!database.serializeAsync) throw new Error('SQLite snapshot export is unavailable');
      return database.serializeAsync();
    },
    share: async (uri) => {
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable');
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Del sikkerhetskopi',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      });
    },
  };
}

export async function cleanupAbandonedBackupExports(): Promise<void> {
  const directory = exportDirectory();
  if (!directory.exists) return;
  for (const entry of directory.list()) entry.delete();
}

function createFileArtifact(name: string): BackupArtifact {
  const directory = exportDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, name);
  if (file.exists) file.delete();

  return {
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

function exportDirectory(): Directory {
  return new Directory(Paths.cache, EXPORT_DIRECTORY);
}

function join(chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
