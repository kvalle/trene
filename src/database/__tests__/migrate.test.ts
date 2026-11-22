import { DatabaseSync } from 'node:sqlite';

import { inspectDatabase } from '../inspectDatabase';
import { migrateDatabase, SCHEMA_VERSION } from '../migrate';
import { VERSION_ONE_SQL } from '../schema';
import type { Database, DatabaseValue } from '../types';
import { exerciseNameKey } from '../../domain/exerciseName';

class TestDatabase implements Database {
  constructor(private readonly database = new DatabaseSync(':memory:')) {}

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

  run(source: string, ...params: (string | number | null)[]) {
    return this.database.prepare(source).run(...params);
  }
}

describe('migrateDatabase', () => {
  test('creates the current schema and keeps existing data on repeated startup', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    expect((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version)
      .toBe(SCHEMA_VERSION);
    database.run(
      "INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)",
      'Knebøy',
      exerciseNameKey('Knebøy'),
      '2026-08-03T10:00:00.000Z',
    );

    await migrateDatabase(database);

    expect((await database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM exercises'))?.count)
      .toBe(1);
    await database.closeAsync();
  });

  test('enforces generated IDs, relationships, and one active workout', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    database.run(
      "INSERT INTO exercises (name, name_key, created_at) VALUES ('Markløft', 'markløft', 'now')",
    );
    database.run("INSERT INTO workouts (training_context_id, status, started_at) VALUES (1, 'active', 'now')");

    const exercise = await database.getFirstAsync<{ id: number }>('SELECT id FROM exercises');
    expect(exercise?.id).toBe(1);
    expect(() =>
      database.run("INSERT INTO workouts (training_context_id, status, started_at) VALUES (1, 'active', 'later')"),
    ).toThrow();

    const workout = await database.getFirstAsync<{ id: number }>('SELECT id FROM workouts');
    database.run(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      workout!.id,
      exercise!.id,
    );
    const workoutExercise = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM workout_exercises',
    );
    expect(() =>
      database.run(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 10.12, 5)',
        workoutExercise!.id,
      ),
    ).toThrow();
    expect(() =>
      database.run(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 10.1, 5.5)',
        workoutExercise!.id,
      ),
    ).toThrow();
    expect(() =>
      database.run(
        "INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES ('missing', ?, 0)",
        exercise!.id,
      ),
    ).toThrow();
    await database.closeAsync();
  });

  test('uses a Unicode-aware key for case-insensitive exercise uniqueness', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    database.run(
      'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
      'Ævelse',
      exerciseNameKey('Ævelse'),
      'now',
    );

    expect(() =>
      database.run(
        'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
        'ævelse',
        exerciseNameKey('ævelse'),
        'later',
      ),
    ).toThrow();
    await database.closeAsync();
  });

  test('starts a fresh database at schema 2 with only the kontekst "Standard"', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    expect(SCHEMA_VERSION).toBe(2);
    expect(await database.getAllAsync('SELECT name, name_key, archived_at FROM training_contexts'))
      .toEqual([{ name: 'Standard', name_key: 'standard', archived_at: null }]);
    await expect(inspectDatabase(database)).resolves.toMatchObject({ schemaVersion: 2 });
    await database.closeAsync();
  });

  test('migrates schema 1 into "Standard" without changing existing treningsøkter', async () => {
    const database = await schemaOneDatabase();
    const before = await workoutData(database);

    await migrateDatabase(database);

    const contexts = await database.getAllAsync<{ id: number; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM training_contexts',
    );
    expect(contexts).toEqual([{ id: expect.any(Number), name: 'Standard', created_at: expect.any(String) }]);
    expect(await database.getAllAsync('SELECT id, training_context_id FROM workouts ORDER BY id'))
      .toEqual([{ id: 2, training_context_id: contexts[0]!.id }, { id: 3, training_context_id: contexts[0]!.id }]);
    expect(await workoutData(database)).toEqual(before);
    expect(await database.getFirstAsync('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await expect(inspectDatabase(database)).resolves.toMatchObject({
      schemaVersion: 2,
      tableCounts: { training_contexts: 1, workouts: 2, workout_exercises: 2, workout_sets: 2 },
    });
    await database.closeAsync();
  });

  test('keeps cascades intact and never reuses deleted workout ids after migrating', async () => {
    const database = await schemaOneDatabase();
    await migrateDatabase(database);

    database.run('DELETE FROM workouts WHERE id = 3');
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM workout_exercises WHERE workout_id = 3'))
      .toEqual({ count: 0 });
    const inserted = database.run(
      "INSERT INTO workouts (training_context_id, status, started_at) VALUES (1, 'active', '2026-08-03T12:00:00.000Z')",
    );
    expect(Number(inserted.lastInsertRowid)).toBe(5);
    await database.closeAsync();
  });

  test('rejects workouts without kontekst and kontekster that are still in use', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    expect(() => database.run(
      "INSERT INTO workouts (status, started_at) VALUES ('active', '2026-08-03T12:00:00.000Z')",
    )).toThrow();
    expect(() => database.run(
      "INSERT INTO workouts (training_context_id, status, started_at) VALUES (99, 'active', '2026-08-03T12:00:00.000Z')",
    )).toThrow();
    database.run(
      "INSERT INTO workouts (training_context_id, status, started_at) VALUES (1, 'active', '2026-08-03T12:00:00.000Z')",
    );
    expect(() => database.run('DELETE FROM training_contexts WHERE id = 1')).toThrow();
    expect(() => database.run(
      "INSERT INTO training_contexts (name, name_key, created_at) VALUES ('STANDARD', 'standard', 'now')",
    )).toThrow();
    await database.closeAsync();
  });

  test('rolls back a failed migration and leaves schema 1 untouched', async () => {
    const database = await schemaOneDatabase();
    database.run('CREATE TABLE training_contexts (id INTEGER)');

    await expect(migrateDatabase(database)).rejects.toThrow();

    expect(await database.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
    expect(await database.getAllAsync('SELECT id FROM workouts ORDER BY id')).toEqual([{ id: 2 }, { id: 3 }]);
    expect(await database.getFirstAsync('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await database.closeAsync();
  });
});

async function schemaOneDatabase(): Promise<TestDatabase> {
  const database = new TestDatabase();
  await database.execAsync(VERSION_ONE_SQL);
  await database.execAsync('PRAGMA user_version = 1; PRAGMA foreign_keys = ON;');
  database.run(
    'INSERT INTO exercises (id, name, name_key, created_at) VALUES (1, ?, ?, ?)',
    'Knebøy', exerciseNameKey('Knebøy'), '2026-08-03T09:00:00.000Z',
  );
  database.run(
    "INSERT INTO workouts (id, status, started_at, completed_at) VALUES (1, 'completed', '2026-08-01T10:00:00.000Z', '2026-08-01T11:00:00.000Z')",
  );
  database.run(
    "INSERT INTO workouts (id, status, started_at, completed_at) VALUES (2, 'completed', '2026-08-02T10:00:00.000Z', '2026-08-02T11:00:00.000Z')",
  );
  database.run("INSERT INTO workouts (id, status, started_at) VALUES (3, 'active', '2026-08-03T10:00:00.000Z')");
  database.run(
    "INSERT INTO workouts (id, status, started_at, completed_at) VALUES (4, 'completed', '2026-08-03T11:00:00.000Z', '2026-08-03T11:30:00.000Z')",
  );
  database.run('DELETE FROM workouts WHERE id IN (1, 4)');
  database.run('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (1, 2, 1, 0), (2, 3, 1, 0)');
  database.run(
    "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (1, 80, 5, '2026-08-02T10:30:00.000Z'), (2, NULL, NULL, NULL)",
  );
  return database;
}

async function workoutData(database: TestDatabase) {
  return {
    workouts: await database.getAllAsync('SELECT id, status, started_at, completed_at FROM workouts ORDER BY id'),
    memberships: await database.getAllAsync('SELECT * FROM workout_exercises ORDER BY id'),
    sets: await database.getAllAsync('SELECT * FROM workout_sets ORDER BY id'),
  };
}
