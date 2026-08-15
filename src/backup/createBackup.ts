import type { DatabaseRuntime } from '../database/DatabaseRuntime';
import type { DatabaseInspection } from '../database/inspectDatabase';
import type { Database } from '../database/types';
import type {
  BackupArchiveReader,
  BackupByteSink,
  BackupByteSource,
  BackupManifestV1,
} from './types';
import { createBackupPackage, inspectBackupPackage } from './packageCodec';

export interface BackupArtifact extends BackupArchiveReader, BackupByteSource {
  uri: string;
  sink(): BackupByteSink;
  remove(): void;
}

export interface BackupPlatform {
  createArtifact(name: string): BackupArtifact;
  inspectSnapshot(source: BackupByteSource): Promise<DatabaseInspection>;
  serializeSnapshot(database: Database): Promise<Uint8Array>;
  share(uri: string): Promise<void>;
}

export interface CreateBackupOptions {
  appVersion: string;
  now?: () => Date;
}

export async function createAndShareBackup(
  runtime: DatabaseRuntime,
  platform: BackupPlatform,
  options: CreateBackupOptions,
): Promise<BackupManifestV1> {
  const createdAt = (options.now ?? (() => new Date()))().toISOString();
  const suffix = createdAt.replaceAll(':', '-');
  const artifacts: BackupArtifact[] = [];

  try {
    const snapshot = platform.createArtifact(`trene-export-${suffix}.sqlite`);
    artifacts.push(snapshot);
    const backup = platform.createArtifact(`trene-backup-${suffix}.trene-backup`);
    artifacts.push(backup);
    const extracted = platform.createArtifact(`trene-check-${suffix}.sqlite`);
    artifacts.push(extracted);
    const manifest = await runtime.runExclusive(async (maintenance) => {
      const inspection = await maintenance.run(async (database) => {
        const bytes = await platform.serializeSnapshot(database);
        await writeBytes(snapshot.sink(), bytes);
        return platform.inspectSnapshot(snapshot);
      });
      const result = await createBackupPackage({
        schemaVersion: inspection.schemaVersion,
        appVersion: options.appVersion,
        createdAt,
        tableCounts: inspection.tableCounts,
        database: snapshot,
      }, backup.sink());
      return result;
    });

    const packageInspection = await inspectBackupPackage(backup, {
      createComponentSink: async (path) => {
        if (path !== 'database.sqlite') throw new Error(`Unexpected backup component: ${path}`);
        return extracted.sink();
      },
    });
    if (packageInspection.status !== 'valid') throw new Error('The newly created backup format is unsupported');
    const snapshotInspection = await platform.inspectSnapshot(extracted);
    if (
      snapshotInspection.schemaVersion !== manifest.schemaVersion
      || JSON.stringify(snapshotInspection.tableCounts) !== JSON.stringify(manifest.tableCounts)
    ) {
      throw new Error('Backup contents differ from the validated snapshot');
    }

    await platform.share(backup.uri);
    return manifest;
  } finally {
    artifacts.forEach((artifact) => artifact.remove());
  }
}

async function writeBytes(sink: BackupByteSink, bytes: Uint8Array): Promise<void> {
  try {
    await sink.write(bytes);
    await sink.close();
  } catch (error) {
    await sink.abort();
    throw error;
  }
}
