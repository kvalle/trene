import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import { deleteCompletedWorkout } from '../workouts';
import {
  createExercise,
  DuplicateExerciseNameError,
  listExercises,
  searchExercises,
} from '../exercises';

class TestDatabase implements Database {
  constructor(private readonly database = new DatabaseSync(':memory:')) {}
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

describe('exercise persistence', () => {
  test('persists exercises and rejects case-insensitive duplicates', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    const id = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    expect(id).toBe(1);
    await expect(createExercise(database, 'KNEBØY', exerciseNameKey('KNEBØY')))
      .rejects.toBeInstanceOf(DuplicateExerciseNameError);
    expect(await listExercises(database)).toEqual([{ id: 1, name: 'Knebøy', workoutCount: 0 }]);
  });

  test('maps a database uniqueness race to the duplicate domain error without changing data', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const racingDatabase: Database = {
      closeAsync: () => database.closeAsync(),
      execAsync: (source) => database.execAsync(source),
      getAllAsync: (source, ...params) => database.getAllAsync(source, ...params),
      getFirstAsync: async () => null,
      runAsync: async (source, ...params) => {
        await database.runAsync(
          'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
          'Knebøy',
          exerciseNameKey('Knebøy'),
          'race',
        );
        return database.runAsync(source, ...params);
      },
    };

    await expect(createExercise(racingDatabase, 'KNEBØY', exerciseNameKey('KNEBØY')))
      .rejects.toBeInstanceOf(DuplicateExerciseNameError);
    expect(await database.getAllAsync<{ name: string }>('SELECT name FROM exercises'))
      .toEqual([{ name: 'Knebøy' }]);
  });

  test('sorts in Bokmål order with stable IDs and searches substrings without case', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    for (const name of ['Åløft', 'øvelse', 'Z-press', 'armheving', 'Armheving', 'Abe', 'Ábe']) {
      await database.runAsync(
        'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
        name,
        `${exerciseNameKey(name)}-${name === 'Armheving' ? '2' : name}`,
        'now',
      );
    }

    const exercises = await listExercises(database);
    expect(exercises.map(({ name }) => name)).toEqual([
      'Abe',
      'Ábe',
      'armheving',
      'Armheving',
      'Z-press',
      'øvelse',
      'Åløft',
    ]);
    expect(searchExercises(exercises, 'HEV')).toHaveLength(2);
  });

  test('counts only completed workouts with a confirmed set', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const workout = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'start', 'end')",
    );
    const membership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      workout.lastInsertRowId,
      exerciseId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 10, 5)',
      membership.lastInsertRowId,
    );
    expect((await listExercises(database))[0].workoutCount).toBe(0);
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 10, 5, ?)',
      membership.lastInsertRowId,
      'confirmed',
    );
    expect((await listExercises(database))[0].workoutCount).toBe(1);

    await deleteCompletedWorkout(database, workout.lastInsertRowId);
    expect((await listExercises(database))[0].workoutCount).toBe(0);
    await expect(database.runAsync('DELETE FROM exercises WHERE id = ?', exerciseId)).resolves.toMatchObject({ changes: 1 });
  });
});
