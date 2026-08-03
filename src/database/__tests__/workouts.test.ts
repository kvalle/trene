import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { createExercise } from '../exercises';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import {
  addExerciseToWorkout,
  cancelActiveWorkout,
  createExerciseInWorkout,
  countExercises,
  getActiveWorkoutId,
  listAvailableExercises,
  loadActiveWorkout,
  startWorkout,
} from '../workouts';

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

describe('active workout persistence', () => {
  test('starts one durable active workout and resumes it', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);

    const workoutId = await startWorkout(database);

    expect(await startWorkout(database)).toBe(workoutId);
    expect(await getActiveWorkoutId(database)).toBe(workoutId);
    expect(await loadActiveWorkout(database)).toEqual({ id: workoutId, exercises: [] });
  });

  test('hides existing membership and adds exercises at stable positions with an empty planned set', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const kneboyId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const aloftId = await createExercise(database, 'Åløft', exerciseNameKey('Åløft'));

    expect((await listAvailableExercises(database, workoutId)).map(({ name }) => name))
      .toEqual(['Knebøy', 'Åløft']);
    await addExerciseToWorkout(database, workoutId, aloftId);
    await addExerciseToWorkout(database, workoutId, kneboyId);

    expect(await loadActiveWorkout(database)).toEqual({
      id: workoutId,
      exercises: [
        { id: expect.any(Number), exerciseId: aloftId, name: 'Åløft', position: 0,
          sets: [{ id: expect.any(Number), loadKg: null, repetitions: null, confirmedAt: null }] },
        { id: expect.any(Number), exerciseId: kneboyId, name: 'Knebøy', position: 1,
          sets: [{ id: expect.any(Number), loadKg: null, repetitions: null, confirmedAt: null }] },
      ],
    });
    expect(await listAvailableExercises(database, workoutId)).toEqual([]);
    expect(await countExercises(database)).toBe(2);
    await expect(addExerciseToWorkout(database, workoutId, aloftId)).rejects.toThrow();
  });

  test('copies confirmed sets from the newest completed workout in displayed order', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const oldWorkout = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'a', '2026-01-01')",
    );
    const oldMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      oldWorkout.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, ?)',
      oldMembership.lastInsertRowId, '2026-01-01T10:00:00Z',
    );
    const newestWorkout = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'b', '2026-02-01')",
    );
    const newestMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      newestWorkout.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 100, 3, ?)',
      newestMembership.lastInsertRowId, '2026-02-01T10:02:00Z',
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 90, 4, ?)',
      newestMembership.lastInsertRowId, '2026-02-01T10:01:00Z',
    );

    const activeId = await startWorkout(database);
    await addExerciseToWorkout(database, activeId, exerciseId);

    expect((await loadActiveWorkout(database))?.exercises[0].sets).toEqual([
      { id: expect.any(Number), loadKg: 90, repetitions: 4, confirmedAt: null },
      { id: expect.any(Number), loadKg: 100, repetitions: 3, confirmedAt: null },
    ]);
  });

  test('creates and selects an exercise atomically', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);

    const exerciseId = await createExerciseInWorkout(
      database, workoutId, 'Benkpress', exerciseNameKey('Benkpress'),
    );

    expect((await loadActiveWorkout(database))?.exercises[0]).toMatchObject({
      exerciseId, name: 'Benkpress', position: 0,
    });
  });

  test('atomically deletes a populated active workout without changing history or exercises', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const completed = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'before', 'after')",
    );
    const completedMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      completed.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'after')",
      completedMembership.lastInsertRowId,
    );
    const activeId = await startWorkout(database);
    await addExerciseToWorkout(database, activeId, exerciseId);

    await cancelActiveWorkout(database, activeId);

    expect(await getActiveWorkoutId(database)).toBeNull();
    expect(await database.getFirstAsync('SELECT id FROM workouts WHERE id = ?', completed.lastInsertRowId))
      .toEqual({ id: completed.lastInsertRowId });
    expect(await database.getFirstAsync(
      'SELECT load_kg, repetitions, confirmed_at FROM workout_sets WHERE workout_exercise_id = ?',
      completedMembership.lastInsertRowId,
    )).toEqual({ load_kg: 80, repetitions: 5, confirmed_at: 'after' });
    expect(await countExercises(database)).toBe(1);
    expect(await database.getFirstAsync('SELECT id FROM workout_exercises WHERE workout_id = ?', activeId)).toBeNull();
  });

  test('rolls back cancellation when deletion fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const activeId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, activeId, exerciseId);
    const workoutBefore = await loadActiveWorkout(database);
    await database.execAsync(`
      CREATE TRIGGER reject_workout_delete BEFORE DELETE ON workouts
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(cancelActiveWorkout(database, activeId)).rejects.toThrow('write failed');
    expect(await getActiveWorkoutId(database)).toBe(activeId);
    expect(await loadActiveWorkout(database)).toEqual(workoutBefore);
  });

  test('rolls back exercise creation when selection fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    await database.runAsync("UPDATE workouts SET status = 'completed', completed_at = 'now' WHERE id = ?", workoutId);

    await expect(createExerciseInWorkout(
      database, workoutId, 'Benkpress', exerciseNameKey('Benkpress'),
    )).rejects.toThrow('Active workout not found');
    expect(await countExercises(database)).toBe(0);
  });
});
