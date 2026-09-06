import { DatabaseSync } from 'node:sqlite';

import { DatabaseRuntime } from '../DatabaseRuntime';
import { migrateDatabase } from '../migrate';
import { deleteAllTrainingData, hasTrainingData } from '../trainingData';
import type { Database, DatabaseValue } from '../types';

class TestDatabase implements Database {
  readonly sqlite = new DatabaseSync(':memory:');
  async execAsync(source: string) { this.sqlite.exec(source); }
  async getFirstAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T | null> {
    return (this.sqlite.prepare(source).get(...params) as T | undefined) ?? null;
  }
  async getAllAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T[]> {
    return this.sqlite.prepare(source).all(...params) as T[];
  }
  async runAsync(source: string, ...params: DatabaseValue[]) {
    const result = this.sqlite.prepare(source).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async closeAsync() { this.sqlite.close(); }
}

test('detects exercises and workouts as training data', async () => {
  const database = new TestDatabase();
  await migrateDatabase(database);
  expect(await hasTrainingData(database)).toBe(false);

  await database.runAsync("INSERT INTO exercises (name, name_key, created_at) VALUES ('Knebøy', 'knebøy', 'now')");
  expect(await hasTrainingData(database)).toBe(true);
  await database.runAsync('DELETE FROM exercises');
  await database.runAsync("INSERT INTO workouts (status, started_at) VALUES ('active', 'now')");
  expect(await hasTrainingData(database)).toBe(true);
});

test('atomically deletes every training record while preserving unrelated data', async () => {
  const database = new TestDatabase();
  await migrateDatabase(database);
  await seedTrainingData(database);
  await database.execAsync("CREATE TABLE preferences (name TEXT); INSERT INTO preferences VALUES ('dark');");
  const runtime = new DatabaseRuntime(async () => database);
  const published = jest.fn();
  runtime.subscribe(published);
  await runtime.start();

  await deleteAllTrainingData(runtime);

  expect(await hasTrainingData(runtime)).toBe(false);
  await runtime.runOperation(async (active) => {
    for (const table of ['exercises', 'workouts', 'workout_exercises', 'workout_sets']) {
      expect((await active.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count).toBe(0);
    }
    expect(await active.getFirstAsync('SELECT name FROM preferences')).toEqual({ name: 'dark' });
  });
  expect(published).toHaveBeenCalledTimes(1);
});

test('rolls back every deletion when the database rejects the operation', async () => {
  const database = new TestDatabase();
  await migrateDatabase(database);
  await seedTrainingData(database);
  await database.execAsync(`
    CREATE TRIGGER reject_exercise_deletion BEFORE DELETE ON exercises
    BEGIN SELECT RAISE(ABORT, 'injected deletion failure'); END;
  `);
  const runtime = new DatabaseRuntime(async () => database);
  await runtime.start();

  await expect(deleteAllTrainingData(runtime)).rejects.toThrow('injected deletion failure');

  await runtime.runOperation(async (active) => {
    expect(await counts(active)).toEqual({ exercises: 1, workouts: 2, workout_exercises: 2, workout_sets: 2 });
  });
  expect(runtime.getGeneration()).toBe(0);
});

async function seedTrainingData(database: Database) {
  const exercise = await database.runAsync(
    "INSERT INTO exercises (name, name_key, created_at) VALUES ('Knebøy', 'knebøy', 'now')",
  );
  for (const [status, completedAt] of [['active', null], ['completed', 'later']] as const) {
    const workout = await database.runAsync(
      'INSERT INTO workouts (status, started_at, completed_at) VALUES (?, ?, ?)',
      status, 'now', completedAt,
    );
    const membership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      workout.lastInsertRowId, exercise.lastInsertRowId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, ?)',
      membership.lastInsertRowId, status === 'completed' ? 'later' : null,
    );
  }
}

async function counts(database: Database) {
  const result: Record<string, number> = {};
  for (const table of ['exercises', 'workouts', 'workout_exercises', 'workout_sets']) {
    result[table] = (await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0;
  }
  return result;
}
