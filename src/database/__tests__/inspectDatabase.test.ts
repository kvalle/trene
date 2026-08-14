import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { inspectDatabase, DatabaseInspectionError } from '../inspectDatabase';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';

class TestDatabase implements Database {
  private readonly database: DatabaseSync;

  constructor(path = ':memory:') {
    this.database = new DatabaseSync(path);
  }

  async execAsync(source: string) {
    this.database.exec(source);
  }

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

  async closeAsync() {
    this.database.close();
  }
}

async function createRichDatabase(): Promise<TestDatabase> {
  const database = new TestDatabase();
  await migrateDatabase(database);
  const exercise = await database.runAsync(
    'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
    'Knebøy', exerciseNameKey('Knebøy'), '2026-08-14T10:00:00.000Z',
  );
  const workout = await database.runAsync(
    "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', ?, ?)",
    '2026-08-14T11:00:00.000Z', '2026-08-14T12:00:00.000Z',
  );
  const membership = await database.runAsync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
    workout.lastInsertRowId, exercise.lastInsertRowId,
  );
  await database.runAsync(`
    INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at)
    VALUES (?, 80.5, 5, ?)
  `, membership.lastInsertRowId, '2026-08-14T11:30:00.000Z');
  return database;
}

async function expectInspectionError(
  database: TestDatabase,
  code: DatabaseInspectionError['code'],
) {
  await expect(inspectDatabase(database)).rejects.toMatchObject({
    name: 'DatabaseInspectionError',
    code,
  });
}

describe('inspectDatabase', () => {
  test('validates an empty exact schema and returns independent counts', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    await expect(inspectDatabase(database)).resolves.toEqual({
      schemaVersion: 1,
      tableCounts: { exercises: 0, workouts: 0, workout_exercises: 0, workout_sets: 0 },
      previewCounts: { workouts: 0, exercises: 0 },
    });
    await database.closeAsync();
  });

  test('validates representative data and returns every authoritative count', async () => {
    const database = await createRichDatabase();

    await expect(inspectDatabase(database)).resolves.toEqual({
      schemaVersion: 1,
      tableCounts: { exercises: 1, workouts: 1, workout_exercises: 1, workout_sets: 1 },
      previewCounts: { workouts: 1, exercises: 1 },
    });
    await database.closeAsync();
  });

  test('rejects unsupported versions and exact-schema changes', async () => {
    const unsupported = new TestDatabase();
    await migrateDatabase(unsupported);
    await unsupported.execAsync('PRAGMA user_version = 2;');
    await expectInspectionError(unsupported, 'unsupported-schema');
    await unsupported.closeAsync();

    const changed = new TestDatabase();
    await migrateDatabase(changed);
    await changed.execAsync('CREATE INDEX unexpected_index ON exercises(name);');
    await expectInspectionError(changed, 'schema-mismatch');
    await changed.closeAsync();
  });

  test('rejects foreign-key damage even when enforcement was bypassed', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    await database.execAsync('PRAGMA foreign_keys = OFF;');
    await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (99, 99, 0)',
    );

    await expectInspectionError(database, 'foreign-key-failed');
    await database.closeAsync();
  });

  test.each([
    ['noncanonical timestamp', "UPDATE exercises SET created_at = 'now'"],
    ['unnormalized exercise name', "UPDATE exercises SET name = ' Knebøy '"],
    ['incorrect exercise key', "UPDATE exercises SET name_key = 'wrong'"],
    ['reversed workout timestamps', "UPDATE workouts SET completed_at = '2026-08-14T10:30:00.000Z'"],
    ['confirmation before workout', "UPDATE workout_sets SET confirmed_at = '2026-08-14T10:30:00.000Z'"],
  ])('rejects %s', async (_description, mutation) => {
    const database = await createRichDatabase();
    await database.execAsync(mutation);

    await expectInspectionError(database, 'invalid-data');
    await database.closeAsync();
  });

  test('rejects noncontiguous positions without repairing them', async () => {
    const database = await createRichDatabase();
    await database.execAsync('PRAGMA ignore_check_constraints = ON;');
    await database.runAsync('UPDATE workout_exercises SET position = 2');

    await expectInspectionError(database, 'invalid-data');
    expect((await database.getFirstAsync<{ position: number }>(
      'SELECT position FROM workout_exercises',
    ))?.position).toBe(2);
    await database.closeAsync();
  });

  test('rejects completed memberships without confirmed sets', async () => {
    const database = await createRichDatabase();
    await database.runAsync('DELETE FROM workout_sets');

    await expectInspectionError(database, 'invalid-data');
    await database.closeAsync();
  });

  test('rejects a completed workout without exercises', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', ?, ?)",
      '2026-08-14T11:00:00.000Z', '2026-08-14T12:00:00.000Z',
    );

    await expectInspectionError(database, 'invalid-data');
    await database.closeAsync();
  });

  test('rejects a real SQLite integrity failure', async () => {
    const database = await createRichDatabase();
    await database.execAsync('PRAGMA ignore_check_constraints = ON;');
    await database.runAsync('UPDATE workout_exercises SET position = -1');
    await database.execAsync('PRAGMA ignore_check_constraints = OFF;');

    await expectInspectionError(database, 'integrity-failed');
    await database.closeAsync();
  });

  test('still validates after a durable close and reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'trene-inspection-'));
    try {
      const path = join(directory, 'database.sqlite');
      const database = new TestDatabase(path);
      await migrateDatabase(database);
      await database.closeAsync();

      const reopened = new TestDatabase(path);
      await expect(inspectDatabase(reopened)).resolves.toMatchObject({ schemaVersion: 1 });
      await reopened.closeAsync();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
