import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { strToU8, zipSync } from 'fflate';

import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import { inspectDatabase, type DatabaseInspection } from '../../database/inspectDatabase';
import { migrateDatabase, SCHEMA_VERSION } from '../../database/migrate';
import { VERSION_ONE_SQL } from '../../database/schema';
import type { Database, DatabaseValue } from '../../database/types';
import { exerciseNameKey } from '../../domain/exerciseName';
import { digestBytes, type RestoreMarkerStage, type RollbackSnapshot } from '../commitRestore';
import type { BackupArtifact } from '../createBackup';
import { createBackupPackage } from '../packageCodec';
import { prepareRestore, type RestorePlatform } from '../prepareRestore';
import type { BackupByteSink, BackupByteSource } from '../types';

type Dataset = 'empty' | 'representative' | 'rich' | 'large';
type SemanticRows = Record<
  'training_contexts' | 'exercises' | 'workouts' | 'workout_exercises' | 'workout_sets',
  unknown[]
>;

describe('restoring a format-1 / schema-1 backup', () => {
  test.each(['representative', 'rich'] as const)(
    'migrates the %s dataset into the kontekst "Standard" without losing data',
    async (dataset) => withDirectory(async (directory) => {
      const sourcePath = join(directory, 'schema-1.sqlite');
      await createSchemaOneDataset(sourcePath, dataset);
      const source = await schemaOneRows(sourcePath);
      const packageArtifact = formatOnePackage(Uint8Array.from(readFileSync(sourcePath)), {
        exercises: source.exercises.length,
        workouts: source.workouts.length,
        workout_exercises: source.workout_exercises.length,
        workout_sets: source.workout_sets.length,
      });
      const livePath = join(directory, 'live.sqlite');
      await createDataset(livePath, 'representative', 1000);

      await restoreArtifact(directory, packageArtifact, livePath);

      const restored = await semanticRows(livePath);
      expect(restored.training_contexts).toEqual([
        expect.objectContaining({ name: 'Standard', name_key: 'standard', archived_at: null }),
      ]);
      const standardId = (restored.training_contexts[0] as { id: number }).id;
      expect(restored.workouts).toEqual(
        source.workouts.map((workout) => ({ ...(workout as object), training_context_id: standardId })),
      );
      expect(restored.exercises).toEqual(source.exercises);
      expect(restored.workout_exercises).toEqual(source.workout_exercises);
      expect(restored.workout_sets).toEqual(source.workout_sets);
      expect((await inspectPath(livePath)).schemaVersion).toBe(SCHEMA_VERSION);
    }),
  );
});

describe('restoring immutable format-2 fixtures', () => {
  test.each(['representative.trene-backup.base64', 'rich-edge-case.trene-backup.base64'])(
    'restores %s with every kontekst and treningsøkt',
    async (name) => withDirectory(async (directory) => {
      const encoded = readFileSync(join(__dirname, '..', '__fixtures__', 'format-2', name), 'utf8').trim();
      const packageArtifact = new MemoryArtifact(
        'private://selected.trene-backup',
        Uint8Array.from(Buffer.from(encoded, 'base64')),
      );
      const livePath = join(directory, 'live.sqlite');
      await createDataset(livePath, 'representative', 1000);

      await restoreArtifact(directory, packageArtifact, livePath);

      const restored = await semanticRows(livePath);
      expect(restored.training_contexts.length).toBeGreaterThan(0);
      expect(new Set(restored.workouts.map((workout) => (workout as { training_context_id: number }).training_context_id)))
        .toEqual(new Set(restored.workouts.length === 1 ? [1] : [1, 2, 3]));
      await expect(inspectPath(livePath)).resolves.toMatchObject({ schemaVersion: 2 });
    }),
  );
});

describe('backup and restore semantic round trips', () => {
  test.each<Dataset>(['empty', 'representative', 'rich', 'large'])(
    'restores every value in the %s dataset and removes existing data',
    async (dataset) => withDirectory(async (directory) => {
      const sourcePath = join(directory, 'source.sqlite');
      const livePath = join(directory, 'live.sqlite');
      await createDataset(sourcePath, dataset);
      await createDataset(livePath, 'representative', 1000);
      const expected = await semanticRows(sourcePath);

      await restorePackage(directory, sourcePath, livePath);

      expect(await semanticRows(livePath)).toEqual(expected);
    }),
  );

  test('restores into an empty database and restores the same backup repeatedly', async () => {
    await withDirectory(async (directory) => {
      const sourcePath = join(directory, 'source.sqlite');
      const livePath = join(directory, 'live.sqlite');
      await createDataset(sourcePath, 'rich');
      await createDataset(livePath, 'empty');
      const expected = await semanticRows(sourcePath);

      await restorePackage(directory, sourcePath, livePath);
      await restorePackage(directory, sourcePath, livePath);

      expect(await semanticRows(livePath)).toEqual(expected);
    });
  });
});

async function restorePackage(directory: string, sourcePath: string, livePath: string): Promise<void> {
  const packageArtifact = new MemoryArtifact('private://selected.trene-backup');
  const sourceInspection = await inspectPath(sourcePath);
  const bytes = Uint8Array.from(readFileSync(sourcePath));
  const source: BackupByteSource = { size: bytes.length, async *open() { yield bytes; } };
  await createBackupPackage({
    appVersion: '1.0.0',
    createdAt: '2026-08-15T12:00:00.000Z',
    database: source,
    schemaVersion: sourceInspection.schemaVersion,
    tableCounts: sourceInspection.tableCounts,
  }, packageArtifact.sink());
  await restoreArtifact(directory, packageArtifact, livePath);
}

async function restoreArtifact(
  directory: string,
  packageArtifact: MemoryArtifact,
  livePath: string,
): Promise<void> {
  let rollbackBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();
  const platform: RestorePlatform = {
    pickAndStagePackage: async () => packageArtifact,
    createArtifact: (name) => new MemoryArtifact(`private://${name}`),
    openDatabase: async (artifact) => {
      const path = join(directory, `inspect-${Math.random().toString(36).slice(2)}.sqlite`);
      writeFileSync(path, (artifact as MemoryArtifact).bytes);
      // Like the native platform, operate on the staged artifact in place.
      return new TestDatabase(path, () => {
        (artifact as MemoryArtifact).bytes = Uint8Array.from(readFileSync(path));
      });
    },
    availableBytes: () => Number.MAX_SAFE_INTEGER,
    createRollbackSnapshot: async (database, inspection) => {
      if (!database.serializeAsync) throw new Error('serialization unavailable');
      rollbackBytes = await database.serializeAsync();
      return snapshot(rollbackBytes, inspection);
    },
    verifyRollbackSnapshot: async (rollback) => {
      expect(digestBytes(rollbackBytes)).toBe(rollback.sha256);
      const path = join(directory, `rollback-${Math.random().toString(36).slice(2)}.sqlite`);
      writeFileSync(path, rollbackBytes);
      return inspectPath(path);
    },
    writeRestoreMarker: async (_stage: RestoreMarkerStage) => undefined,
    activateDatabase: async (artifact) => writeFileSync(livePath, (artifact as MemoryArtifact).bytes),
    activateRollback: async () => writeFileSync(livePath, rollbackBytes),
    cleanupRestoreCommit: () => undefined,
  };
  const prepared = await prepareRestore(platform);
  if (prepared.status !== 'ready') throw new Error('restore was cancelled');
  const runtime = new DatabaseRuntime(async () => new TestDatabase(livePath));
  await runtime.start();
  runtime.subscribe(() => runtime.confirmGeneration(runtime.getGeneration()));
  await prepared.restore.commit(runtime);
  await runtime.close();
}

function snapshot(bytes: Uint8Array, inspection: DatabaseInspection): RollbackSnapshot {
  return {
    size: bytes.length,
    sha256: digestBytes(bytes),
    schemaVersion: inspection.schemaVersion,
    tableCounts: inspection.tableCounts,
    semanticDigest: inspection.semanticDigest,
  };
}

async function createDataset(path: string, dataset: Dataset, idOffset = 0): Promise<void> {
  const database = new TestDatabase(path);
  await migrateDatabase(database);
  const size = dataset === 'empty' ? 0 : dataset === 'representative' ? 1 : dataset === 'rich' ? 4 : 40;
  const standard = (await database.getFirstAsync<{ id: number }>('SELECT id FROM training_contexts'))!.id;
  const gym = dataset === 'rich' ? (await database.runAsync(
    'INSERT INTO training_contexts (name, name_key, archived_at, created_at) VALUES (?, ?, ?, ?)',
    'Treningssenter', exerciseNameKey('Treningssenter'), timestamp(2), timestamp(1),
  )).lastInsertRowId : standard;
  for (let index = 1; index <= size; index += 1) {
    const id = idOffset + index;
    const name = `Exercise ${id}`;
    const startedAt = timestamp(index * 3);
    const completedAt = timestamp(index * 3 + 2);
    await database.runAsync(
      'INSERT INTO exercises (id, name, name_key, created_at) VALUES (?, ?, ?, ?)',
      id, name, exerciseNameKey(name), timestamp(index),
    );
    await database.runAsync(
      'INSERT INTO workouts (id, training_context_id, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)',
      id, index % 2 === 0 ? gym : standard, 'completed', startedAt, completedAt,
    );
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)',
      id, id, id, 0,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (id, workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, ?, ?, ?, ?)',
      id, id, dataset === 'rich' && index === 1 ? 0 : 20 + index / 10, index, timestamp(index * 3 + 1),
    );
  }
  if (dataset === 'rich') {
    const activeId = idOffset + 100;
    const exerciseId = idOffset + 1;
    await database.runAsync(
      'INSERT INTO workouts (id, training_context_id, status, started_at, completed_at) VALUES (?, ?, ?, ?, NULL)',
      activeId, gym, 'active', timestamp(30),
    );
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, 0)',
      activeId, activeId, exerciseId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (id, workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, ?, NULL, NULL, NULL)',
      activeId, activeId,
    );
  }
  await database.closeAsync();
}

async function semanticRows(path: string): Promise<SemanticRows> {
  const database = new TestDatabase(path);
  try {
    return {
      training_contexts: await database.getAllAsync(
        'SELECT id, name, name_key, archived_at, created_at FROM training_contexts ORDER BY id',
      ),
      exercises: await database.getAllAsync('SELECT id, name, name_key, created_at FROM exercises ORDER BY id'),
      workouts: await database.getAllAsync('SELECT id, training_context_id, status, started_at, completed_at FROM workouts ORDER BY id'),
      workout_exercises: await database.getAllAsync('SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY id'),
      workout_sets: await database.getAllAsync('SELECT id, workout_exercise_id, load_kg, repetitions, confirmed_at FROM workout_sets ORDER BY id'),
    };
  } finally {
    await database.closeAsync();
  }
}

async function createSchemaOneDataset(path: string, dataset: 'representative' | 'rich'): Promise<void> {
  const database = new TestDatabase(path);
  await database.execAsync(VERSION_ONE_SQL);
  await database.execAsync('PRAGMA user_version = 1;');
  const size = dataset === 'representative' ? 1 : 4;
  for (let id = 1; id <= size; id += 1) {
    const name = `Exercise ${id}`;
    await database.runAsync(
      'INSERT INTO exercises (id, name, name_key, created_at) VALUES (?, ?, ?, ?)',
      id, name, exerciseNameKey(name), timestamp(id),
    );
    await database.runAsync(
      "INSERT INTO workouts (id, status, started_at, completed_at) VALUES (?, 'completed', ?, ?)",
      id, timestamp(id * 3), timestamp(id * 3 + 2),
    );
    await database.runAsync(
      'INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, 0)',
      id, id, id,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (id, workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, ?, ?, ?, ?)',
      id, id, 20 + id / 10, id, timestamp(id * 3 + 1),
    );
  }
  if (dataset === 'rich') {
    await database.runAsync(
      "INSERT INTO workouts (id, status, started_at, completed_at) VALUES (100, 'active', ?, NULL)",
      timestamp(30),
    );
    await database.runAsync('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (100, 100, 1, 0)');
    await database.runAsync('INSERT INTO workout_sets (id, workout_exercise_id) VALUES (100, 100)');
  }
  await database.closeAsync();
}

function formatOnePackage(databaseBytes: Uint8Array, tableCounts: Record<string, number>): MemoryArtifact {
  const manifest = {
    formatVersion: 1,
    schemaVersion: 1,
    appVersion: '0.1.0',
    createdAt: '2026-08-15T12:00:00.000Z',
    components: [{
      path: 'database.sqlite',
      type: 'sqlite-database',
      size: databaseBytes.length,
      sha256: createHash('sha256').update(databaseBytes).digest('hex'),
    }],
    tableCounts,
  };
  return new MemoryArtifact('private://selected.trene-backup', zipSync({
    'manifest.json': strToU8(`${JSON.stringify(manifest)}\n`),
    'database.sqlite': databaseBytes,
  }));
}

async function schemaOneRows(path: string): Promise<Omit<SemanticRows, 'training_contexts'>> {
  const database = new TestDatabase(path);
  try {
    expect((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(1);
    return {
      exercises: await database.getAllAsync('SELECT id, name, name_key, created_at FROM exercises ORDER BY id'),
      workouts: await database.getAllAsync('SELECT id, status, started_at, completed_at FROM workouts ORDER BY id'),
      workout_exercises: await database.getAllAsync('SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY id'),
      workout_sets: await database.getAllAsync('SELECT id, workout_exercise_id, load_kg, repetitions, confirmed_at FROM workout_sets ORDER BY id'),
    };
  } finally {
    await database.closeAsync();
  }
}

async function inspectPath(path: string): Promise<DatabaseInspection> {
  const database = new TestDatabase(path);
  try { return await inspectDatabase(database); } finally { await database.closeAsync(); }
}

async function withDirectory(work: (directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'trene-round-trip-'));
  try { await work(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function timestamp(minutes: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, minutes)).toISOString();
}

class TestDatabase implements Database {
  private readonly database: DatabaseSync;
  constructor(private readonly path: string, private readonly onClose?: () => void) {
    this.database = new DatabaseSync(path);
  }
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
  async serializeAsync() { return Uint8Array.from(readFileSync(this.path)); }
  async closeAsync() { this.database.close(); this.onClose?.(); }
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
        bytes.set(this.bytes); bytes.set(chunk, this.bytes.length); this.bytes = bytes;
      },
      close: async () => undefined,
      abort: async () => { this.bytes = new Uint8Array(); },
    };
  }
  remove() { this.bytes = new Uint8Array(); }
}
