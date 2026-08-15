import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { migrateDatabase } from '../../database/migrate';
import type { Database, DatabaseValue } from '../../database/types';
import type { BackupArtifact } from '../createBackup';
import { createBackupPackage } from '../packageCodec';
import { prepareRestore, type RestorePlatform } from '../prepareRestore';
import type { BackupByteSink, BackupByteSource } from '../types';

test('prepares a packaged real SQLite snapshot without touching live data', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'trene-restore-'));
  try {
    const databasePath = join(directory, 'source.sqlite');
    const sourceDatabase = new TestDatabase(databasePath);
    await migrateDatabase(sourceDatabase);
    await sourceDatabase.runAsync(
      'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
      'Knebøy', exerciseNameKey('Knebøy'), '2026-08-14T10:00:00.000Z',
    );
    await sourceDatabase.closeAsync();
    const databaseBytes = Uint8Array.from(readFileSync(databasePath));
    const packageArtifact = new MemoryArtifact('private://selected.trene-backup');
    const source: BackupByteSource = { size: databaseBytes.length, async *open() { yield databaseBytes; } };
    await createBackupPackage({
      appVersion: '1.0.0',
      createdAt: '2026-08-14T12:00:00.000Z',
      database: source,
      schemaVersion: 1,
      tableCounts: { exercises: 1, workouts: 0, workout_exercises: 0, workout_sets: 0 },
    }, packageArtifact.sink());

    const platform: RestorePlatform = {
      pickAndStagePackage: async () => packageArtifact,
      createArtifact: (name) => new MemoryArtifact(`private://${name}`),
      openDatabase: async (artifact) => {
        const path = join(directory, 'staged.sqlite');
        writeFileSync(path, (artifact as MemoryArtifact).bytes);
        return new TestDatabase(path);
      },
      availableBytes: () => Number.MAX_SAFE_INTEGER,
      createRollbackSnapshot: async () => { throw new Error('not used'); },
      verifyRollbackSnapshot: async () => { throw new Error('not used'); },
      writeRestoreMarker: async () => undefined,
      activateDatabase: async () => undefined,
      activateRollback: async () => undefined,
      cleanupRestoreCommit: () => undefined,
    };

    const result = await prepareRestore(platform);

    expect(result).toMatchObject({
      status: 'ready',
      restore: {
        createdAt: '2026-08-14T12:00:00.000Z',
        schemaVersion: 1,
        previewCounts: { workouts: 0, exercises: 1 },
      },
    });
    if (result.status === 'ready') result.restore.cancel();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

class TestDatabase implements Database {
  private readonly database: DatabaseSync;
  constructor(path: string) { this.database = new DatabaseSync(path); }
  async execAsync(source: string) { this.database.exec(source); }
  async getFirstAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null;
  }
  async getAllAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T[]> {
    return this.database.prepare(source).all(...params) as T[];
  }
  async runAsync(source: string, ...params: DatabaseValue[]) {
    const result = this.database.prepare(source).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async closeAsync() { this.database.close(); }
}

class MemoryArtifact implements BackupArtifact {
  constructor(readonly uri: string, public bytes = new Uint8Array()) {}
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
  remove() { this.bytes = new Uint8Array(); }
}
