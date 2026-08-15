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
import { atCheckpoint, atCleanupCheckpoint, type FaultCheckpoint } from './faultInjection';

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
  checkpoint?: FaultCheckpoint;
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
    const { snapshot, backup, extracted } = await atCheckpoint(options.checkpoint, 'backup.stage-artifacts', async () => {
      const snapshotArtifact = platform.createArtifact(`trene-export-${suffix}.sqlite`);
      artifacts.push(snapshotArtifact);
      const backupArtifact = platform.createArtifact(`trene-backup-${suffix}.trene-backup`);
      artifacts.push(backupArtifact);
      const extractedArtifact = platform.createArtifact(`trene-check-${suffix}.sqlite`);
      artifacts.push(extractedArtifact);
      return { snapshot: snapshotArtifact, backup: backupArtifact, extracted: extractedArtifact };
    });
    const { manifest, sourceInspection } = await runtime.runExclusive(async (maintenance) => {
      const inspection = await maintenance.run((database) => atCheckpoint(options.checkpoint, 'backup.snapshot', async () => {
        const bytes = await platform.serializeSnapshot(database);
        await writeBytes(snapshot.sink(), bytes);
      }));
      const validated = await atCheckpoint(options.checkpoint, 'backup.snapshot-validation', () => (
        platform.inspectSnapshot(snapshot)
      ));
      const result = await atCheckpoint(options.checkpoint, 'backup.package', () => createBackupPackage({
        schemaVersion: validated.schemaVersion,
        appVersion: options.appVersion,
        createdAt,
        tableCounts: validated.tableCounts,
        database: snapshot,
      }, backup.sink()));
      return { manifest: result, sourceInspection: validated };
    });

    const { packageInspection, snapshotInspection } = await atCheckpoint(
      options.checkpoint,
      'backup.package-validation',
      async () => {
        const inspectedPackage = await inspectBackupPackage(backup, {
          createComponentSink: async (path) => {
            if (path !== 'database.sqlite') throw new Error(`Unexpected backup component: ${path}`);
            return extracted.sink();
          },
        });
        if (inspectedPackage.status !== 'valid') {
          throw new Error('The newly created backup format is unsupported');
        }
        return {
          packageInspection: inspectedPackage,
          snapshotInspection: await platform.inspectSnapshot(extracted),
        };
      },
    );
    if (packageInspection.status !== 'valid') throw new Error('The newly created backup format is unsupported');
    if (
      snapshotInspection.schemaVersion !== manifest.schemaVersion
      || JSON.stringify(snapshotInspection.tableCounts) !== JSON.stringify(manifest.tableCounts)
      || snapshotInspection.semanticDigest !== sourceInspection.semanticDigest
    ) {
      throw new Error('Backup contents differ from the validated snapshot');
    }

    await atCheckpoint(options.checkpoint, 'backup.share', () => platform.share(backup.uri));
    return manifest;
  } finally {
    await atCleanupCheckpoint(options.checkpoint, 'backup.cleanup', () => {
      artifacts.forEach((artifact) => artifact.remove());
    });
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
