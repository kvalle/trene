import { DatabaseSync } from 'node:sqlite';

import { migrateDatabase, SCHEMA_VERSION } from '../migrate';
import type { Database } from '../types';
import { exerciseNameKey } from '../../domain/exerciseName';

class TestDatabase implements Database {
  constructor(private readonly database = new DatabaseSync(':memory:')) {}

  async execAsync(source: string) {
    this.database.exec(source);
  }

  async getFirstAsync<T>(source: string): Promise<T | null> {
    return (this.database.prepare(source).get() as T | undefined) ?? null;
  }

  async closeAsync() {
    this.database.close();
  }

  run(source: string, ...params: (string | number | null)[]) {
    return this.database.prepare(source).run(...params);
  }
}

describe('migrateDatabase', () => {
  test('creates version one and keeps existing data on repeated startup', async () => {
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
    database.run("INSERT INTO workouts (status, started_at) VALUES ('active', 'now')");

    const exercise = await database.getFirstAsync<{ id: number }>('SELECT id FROM exercises');
    expect(exercise?.id).toBe(1);
    expect(() =>
      database.run("INSERT INTO workouts (status, started_at) VALUES ('active', 'later')"),
    ).toThrow();

    const workout = await database.getFirstAsync<{ id: number }>('SELECT id FROM workouts');
    database.run(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      workout!.id,
      exercise!.id,
    );
    const membership = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM workout_exercises',
    );
    expect(() =>
      database.run(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 10.12, 5)',
        membership!.id,
      ),
    ).toThrow();
    expect(() =>
      database.run(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 10.1, 5.5)',
        membership!.id,
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
});
