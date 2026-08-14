import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exerciseNameKey } from '../../domain/exerciseName';
import { createExercise } from '../exercises';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import {
  addExerciseToWorkout,
  addWorkoutSet,
  cancelActiveWorkout,
  completeWorkout,
  createExerciseInWorkout,
  countExercises,
  confirmWorkoutSet,
  deleteCompletedWorkout,
  deletePlannedWorkoutSet,
  getActiveWorkoutId,
  listAvailableExercises,
  listCompletedWorkouts,
  loadCompletedWorkout,
  loadActiveWorkout,
  removeExerciseFromWorkout,
  savePlannedWorkoutSet,
  startWorkout,
  unconfirmWorkoutSet,
} from '../workouts';

class TestDatabase implements Database {
  private readonly database: DatabaseSync;

  constructor(path = ':memory:') {
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
    const [firstId, secondId] = (await loadActiveWorkout(database))!.exercises[0].sets.map(({ id }) => id);
    expect(firstId).toBeLessThan(secondId);
  });

  test('uses stable workout and set IDs to break equal completion-time ties', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const firstWorkout = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'a', '2026-02-01')",
    );
    const secondWorkout = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'b', '2026-02-01')",
    );
    const firstMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      firstWorkout.lastInsertRowId, exerciseId,
    );
    const secondMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      secondWorkout.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'same')",
      firstMembership.lastInsertRowId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 90, 3, 'same')",
      firstMembership.lastInsertRowId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 100, 1, 'later')",
      secondMembership.lastInsertRowId,
    );

    const activeId = await startWorkout(database);
    await addExerciseToWorkout(database, activeId, exerciseId);

    expect((await loadActiveWorkout(database))?.exercises[0].sets.map(({ loadKg }) => loadKg))
      .toEqual([80, 90]);
  });

  test('falls back to the newest remaining workout and survives reload', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'trene-suggestions-'));
    const path = join(directory, 'trene.db');
    let database = new TestDatabase(path);
    try {
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
        "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'old')",
        oldMembership.lastInsertRowId,
      );
      const deletedWorkout = await database.runAsync(
        "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'b', '2026-02-01')",
      );
      const deletedMembership = await database.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
        deletedWorkout.lastInsertRowId, exerciseId,
      );
      await database.runAsync(
        "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 100, 3, 'new')",
        deletedMembership.lastInsertRowId,
      );
      await deleteCompletedWorkout(database, deletedWorkout.lastInsertRowId);

      const activeId = await startWorkout(database);
      await addExerciseToWorkout(database, activeId, exerciseId);
      const beforeRestart = await loadActiveWorkout(database);
      await database.closeAsync();
      database = new TestDatabase(path);
      await migrateDatabase(database);

      expect(beforeRestart?.exercises[0].sets).toEqual([
        { id: expect.any(Number), loadKg: 80, repetitions: 5, confirmedAt: null },
      ]);
      expect(await loadActiveWorkout(database)).toEqual(beforeRestart);
      expect(await listCompletedWorkouts(database)).toEqual([
        { id: oldWorkout.lastInsertRowId, completedAt: '2026-01-01', exerciseCount: 1 },
      ]);
    } finally {
      await database.closeAsync();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('rolls back membership and every suggestion when suggestion insertion fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const history = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'a', '2026-01-01')",
    );
    const historyMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      history.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'first')",
      historyMembership.lastInsertRowId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 90, 3, 'second')",
      historyMembership.lastInsertRowId,
    );
    const activeId = await startWorkout(database);
    await database.execAsync(`
      CREATE TRIGGER reject_second_suggestion BEFORE INSERT ON workout_sets
      WHEN NEW.confirmed_at IS NULL AND NEW.load_kg = 90
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(addExerciseToWorkout(database, activeId, exerciseId)).rejects.toThrow('write failed');
    expect(await loadActiveWorkout(database)).toEqual({ id: activeId, exercises: [] });
    expect(await listAvailableExercises(database, activeId)).toEqual([
      { id: exerciseId, name: 'Markløft' },
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

  test('deletes only the selected completed workout and returns the next focus target', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const workouts = [];
    for (const completedAt of ['2026-03-01', '2026-02-01', '2026-01-01']) {
      const workout = await database.runAsync(
        "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'start', ?)",
        completedAt,
      );
      const membership = await database.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
        workout.lastInsertRowId, exerciseId,
      );
      await database.runAsync(
        "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'done')",
        membership.lastInsertRowId,
      );
      workouts.push({ workoutId: workout.lastInsertRowId, membershipId: membership.lastInsertRowId });
    }
    const activeId = await startWorkout(database);

    await expect(deleteCompletedWorkout(database, workouts[1].workoutId)).resolves.toEqual({
      focusWorkoutId: workouts[0].workoutId,
    });

    expect(await database.getFirstAsync('SELECT id FROM workouts WHERE id = ?', workouts[1].workoutId)).toBeNull();
    expect(await database.getFirstAsync('SELECT id FROM workout_exercises WHERE id = ?', workouts[1].membershipId)).toBeNull();
    expect(await database.getFirstAsync('SELECT id FROM workout_sets WHERE workout_exercise_id = ?', workouts[1].membershipId)).toBeNull();
    expect((await listCompletedWorkouts(database)).map(({ id }) => id)).toEqual([
      workouts[0].workoutId, workouts[2].workoutId,
    ]);
    expect(await getActiveWorkoutId(database)).toBe(activeId);
    expect(await countExercises(database)).toBe(1);
    await expect(deleteCompletedWorkout(database, activeId)).rejects.toThrow('Completed workout not found');
  });

  test('chooses an older focus target and rolls back a failed completed-workout deletion', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const older = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'a', '2026-01-01')",
    );
    const newest = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'b', '2026-02-01')",
    );
    const membership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      newest.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'done')",
      membership.lastInsertRowId,
    );
    await database.execAsync(`
      CREATE TRIGGER reject_membership_delete AFTER DELETE ON workout_exercises
      WHEN OLD.id = ${membership.lastInsertRowId}
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(deleteCompletedWorkout(database, newest.lastInsertRowId)).rejects.toThrow('write failed');
    expect(await loadCompletedWorkout(database, newest.lastInsertRowId)).not.toBeNull();
    expect(await database.getFirstAsync('SELECT id FROM workout_sets WHERE workout_exercise_id = ?', membership.lastInsertRowId)).not.toBeNull();
    await database.execAsync('DROP TRIGGER reject_membership_delete;');
    await expect(deleteCompletedWorkout(database, newest.lastInsertRowId)).resolves.toEqual({
      focusWorkoutId: older.lastInsertRowId,
    });
    await expect(deleteCompletedWorkout(database, older.lastInsertRowId)).resolves.toEqual({ focusWorkoutId: null });
  });

  test('atomically completes and prunes a workout while preserving card and set order', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const firstExerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const secondExerciseId = await createExercise(database, 'Benkpress', exerciseNameKey('Benkpress'));
    const emptyExerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    await addExerciseToWorkout(database, workoutId, firstExerciseId);
    await addExerciseToWorkout(database, workoutId, secondExerciseId);
    await addExerciseToWorkout(database, workoutId, emptyExerciseId);
    const active = (await loadActiveWorkout(database))!;
    const firstSet = active.exercises[0].sets[0].id;
    const secondSet = active.exercises[1].sets[0].id;
    const laterFirstSet = (await addWorkoutSet(database, workoutId, active.exercises[0].id)).id;
    await confirmWorkoutSet(database, workoutId, laterFirstSet, 90, 3, '2026-08-05T10:02:00Z');
    await confirmWorkoutSet(database, workoutId, firstSet, 80, 5, '2026-08-05T10:01:00Z');
    await confirmWorkoutSet(database, workoutId, secondSet, 60, 8, '2026-08-05T10:03:00Z');
    await addWorkoutSet(database, workoutId, active.exercises[1].id);

    await completeWorkout(database, workoutId, '2026-08-05T10:30:00Z');

    expect(await getActiveWorkoutId(database)).toBeNull();
    expect(await loadCompletedWorkout(database, workoutId)).toEqual({
      id: workoutId,
      completedAt: '2026-08-05T10:30:00Z',
      exercises: [
        { ...active.exercises[0], sets: [
          { id: firstSet, loadKg: 80, repetitions: 5, confirmedAt: '2026-08-05T10:01:00Z' },
          { id: laterFirstSet, loadKg: 90, repetitions: 3, confirmedAt: '2026-08-05T10:02:00Z' },
        ] },
        { ...active.exercises[1], sets: [
          { id: secondSet, loadKg: 60, repetitions: 8, confirmedAt: '2026-08-05T10:03:00Z' },
        ] },
      ],
    });
  });

  test('lists completed workouts newest-first with stable ties and saved exercise counts', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const secondExerciseId = await createExercise(database, 'Benkpress', exerciseNameKey('Benkpress'));
    const oldest = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'a', '2026-01-01')",
    );
    const firstTie = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'b', '2026-02-01')",
    );
    const secondTie = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'c', '2026-02-01')",
    );
    await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      oldest.lastInsertRowId, exerciseId,
    ).then((membership) => database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'done')",
      membership.lastInsertRowId,
    ));
    await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 1)',
      firstTie.lastInsertRowId, secondExerciseId,
    ).then((membership) => database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 60, 8, 'done')",
      membership.lastInsertRowId,
    ));
    await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      firstTie.lastInsertRowId, exerciseId,
    ).then(async (membership) => {
      await database.runAsync(
        "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 80, 5, 'done')",
        membership.lastInsertRowId,
      );
      await database.runAsync(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 90, 3)',
        membership.lastInsertRowId,
      );
    });
    const unconfirmedMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      secondTie.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, 90, 3)',
      unconfirmedMembership.lastInsertRowId,
    );
    await startWorkout(database);

    expect(await listCompletedWorkouts(database)).toEqual([
      { id: firstTie.lastInsertRowId, completedAt: '2026-02-01', exerciseCount: 2 },
      { id: secondTie.lastInsertRowId, completedAt: '2026-02-01', exerciseCount: 0 },
      { id: oldest.lastInsertRowId, completedAt: '2026-01-01', exerciseCount: 1 },
    ]);
  });

  test('loads the current exercise name in completed workout detail', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Gammelt navn', exerciseNameKey('Gammelt navn'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const setId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;
    await confirmWorkoutSet(database, workoutId, setId, 80, 5, 'confirmed');
    await completeWorkout(database, workoutId, 'completed');
    await database.runAsync(
      'UPDATE exercises SET name = ?, name_key = ? WHERE id = ?',
      'Nytt navn', exerciseNameKey('Nytt navn'), exerciseId,
    );

    expect((await loadCompletedWorkout(database, workoutId))!.exercises[0].name).toBe('Nytt navn');
  });

  test('rejects completion without a completed set', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);

    await expect(completeWorkout(database, workoutId, 'now')).rejects.toThrow('Completable workout not found');
    expect(await getActiveWorkoutId(database)).toBe(workoutId);
  });

  test('rolls back every completion change when the transaction fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const setId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;
    await confirmWorkoutSet(database, workoutId, setId, 80, 5, 'confirmed');
    await addWorkoutSet(database, workoutId, (await loadActiveWorkout(database))!.exercises[0].id);
    const before = await loadActiveWorkout(database);
    await database.execAsync(`
      CREATE TRIGGER reject_workout_completion BEFORE UPDATE ON workouts
      WHEN NEW.status = 'completed'
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(completeWorkout(database, workoutId, 'completed')).rejects.toThrow('write failed');
    expect(await loadActiveWorkout(database)).toEqual(before);
    expect(await loadCompletedWorkout(database, workoutId)).toBeNull();
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

  test('persists, confirms, orders, unconfirms, and reconfirms stable sets', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const membershipId = (await loadActiveWorkout(database))!.exercises[0].id;
    const firstId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;
    const secondId = (await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id) VALUES (?)', membershipId,
    )).lastInsertRowId;

    await savePlannedWorkoutSet(database, workoutId, firstId, 80.5, 5);
    await savePlannedWorkoutSet(database, workoutId, secondId, 90, 3);
    await confirmWorkoutSet(database, workoutId, secondId, 90, 3, '2026-01-01T10:00:00Z');
    await confirmWorkoutSet(database, workoutId, firstId, 80.5, 5, '2026-01-01T10:00:00Z');

    expect((await loadActiveWorkout(database))!.exercises[0].sets.map(({ id }) => id))
      .toEqual([firstId, secondId]);

    await unconfirmWorkoutSet(database, workoutId, firstId);
    expect((await loadActiveWorkout(database))!.exercises[0].sets).toEqual([
      { id: secondId, loadKg: 90, repetitions: 3, confirmedAt: '2026-01-01T10:00:00Z' },
      { id: firstId, loadKg: 80.5, repetitions: 5, confirmedAt: null },
    ]);

    await confirmWorkoutSet(database, workoutId, firstId, 81, 6, '2026-01-01T10:02:00Z');
    expect((await loadActiveWorkout(database))!.exercises[0].sets.map(({ id }) => id))
      .toEqual([secondId, firstId]);
  });

  test('deletes only planned sets from an active workout', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const setId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;

    await confirmWorkoutSet(database, workoutId, setId, 0, 1, 'now');
    await expect(deletePlannedWorkoutSet(database, workoutId, setId)).rejects.toThrow('Planned set not found');
    await unconfirmWorkoutSet(database, workoutId, setId);
    await deletePlannedWorkoutSet(database, workoutId, setId);

    expect((await loadActiveWorkout(database))!.exercises[0].sets).toEqual([]);
  });

  test('adds sets from the latest active confirmed set without querying history', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const history = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'before', 'after')",
    );
    const historyMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      history.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 200, 1, 'after')",
      historyMembership.lastInsertRowId,
    );
    const workoutId = await startWorkout(database);
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const exercise = (await loadActiveWorkout(database))!.exercises[0];
    const suggestedSet = exercise.sets[0];
    await savePlannedWorkoutSet(database, workoutId, suggestedSet.id, 80, 5);
    await confirmWorkoutSet(database, workoutId, suggestedSet.id, 80, 5, '2026-01-01T10:00:00Z');

    const copied = await addWorkoutSet(database, workoutId, exercise.id);

    expect(copied).toEqual({ id: expect.any(Number), loadKg: 80, repetitions: 5, confirmedAt: null });
  });

  test('does not query history added after exercise membership when adding a set', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const workoutId = await startWorkout(database);
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const activeExercise = (await loadActiveWorkout(database))!.exercises[0];
    const history = await database.runAsync(
      "INSERT INTO workouts (status, started_at, completed_at) VALUES ('completed', 'before', 'after')",
    );
    const historyMembership = await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
      history.lastInsertRowId, exerciseId,
    );
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, 200, 1, 'after')",
      historyMembership.lastInsertRowId,
    );

    expect(await addWorkoutSet(database, workoutId, activeExercise.id)).toMatchObject({
      loadKg: null, repetitions: null, confirmedAt: null,
    });
  });

  test('adds a set from the last fully valid planned set, otherwise empty', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const exercise = (await loadActiveWorkout(database))!.exercises[0];

    const emptySet = await addWorkoutSet(database, workoutId, exercise.id);
    expect(emptySet).toMatchObject({
      loadKg: null, repetitions: null, confirmedAt: null,
    });
    await deletePlannedWorkoutSet(database, workoutId, emptySet.id);
    await savePlannedWorkoutSet(database, workoutId, exercise.sets[0].id, 80, 5);
    expect(await addWorkoutSet(database, workoutId, exercise.id)).toMatchObject({
      loadKg: 80, repetitions: 5, confirmedAt: null,
    });
    const latestSet = (await loadActiveWorkout(database))!.exercises[0].sets.at(-1)!;
    await savePlannedWorkoutSet(database, workoutId, latestSet.id, 90, null);
    expect(await addWorkoutSet(database, workoutId, exercise.id)).toMatchObject({
      loadKg: null, repetitions: null, confirmedAt: null,
    });
  });

  test('removes only active membership and keeps remaining positions contiguous', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const kneboyId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const markloftId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    await addExerciseToWorkout(database, workoutId, kneboyId);
    await addExerciseToWorkout(database, workoutId, markloftId);
    const [kneboy, markloft] = (await loadActiveWorkout(database))!.exercises;
    await confirmWorkoutSet(database, workoutId, kneboy.sets[0].id, 80, 5, 'now');

    await removeExerciseFromWorkout(database, workoutId, kneboy.id);

    expect((await loadActiveWorkout(database))!.exercises).toEqual([{ ...markloft, position: 0 }]);
    expect(await countExercises(database)).toBe(2);
    expect((await listAvailableExercises(database, workoutId)).map(({ id }) => id)).toEqual([kneboyId]);
  });

  test('keeps unique insertion order across interleaved set confirmations and later additions', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const firstId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const secondId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const thirdId = await createExercise(database, 'Benkpress', exerciseNameKey('Benkpress'));
    await addExerciseToWorkout(database, workoutId, firstId);
    await addExerciseToWorkout(database, workoutId, secondId);
    const [first, second] = (await loadActiveWorkout(database))!.exercises;
    await confirmWorkoutSet(database, workoutId, second.sets[0].id, 100, 3, '2026-01-01T10:00:00Z');
    await confirmWorkoutSet(database, workoutId, first.sets[0].id, 80, 5, '2026-01-01T10:01:00Z');
    await removeExerciseFromWorkout(database, workoutId, first.id);
    await addExerciseToWorkout(database, workoutId, thirdId);

    expect((await loadActiveWorkout(database))!.exercises.map(({ exerciseId, position }) => ({ exerciseId, position })))
      .toEqual([{ exerciseId: secondId, position: 0 }, { exerciseId: thirdId, position: 1 }]);
    await expect(addExerciseToWorkout(database, workoutId, secondId)).rejects.toThrow();
  });

  test('compacts positions when completion removes an empty exercise', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const emptyId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const retainedId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    await addExerciseToWorkout(database, workoutId, emptyId);
    await addExerciseToWorkout(database, workoutId, retainedId);
    const [, retained] = (await loadActiveWorkout(database))!.exercises;
    await confirmWorkoutSet(
      database, workoutId, retained.sets[0].id, 100, 3, '2026-08-05T10:15:00.000Z',
    );

    await completeWorkout(database, workoutId, '2026-08-05T10:30:00.000Z');

    expect((await loadCompletedWorkout(database, workoutId))!.exercises).toEqual([
      { ...retained, position: 0, sets: [{ ...retained.sets[0], loadKg: 100, repetitions: 3,
        confirmedAt: '2026-08-05T10:15:00.000Z' }] },
    ]);
  });

  test('rolls back failed set additions and exercise removals', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const exercise = (await loadActiveWorkout(database))!.exercises[0];
    await database.execAsync(`
      CREATE TRIGGER reject_set_insert BEFORE INSERT ON workout_sets
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
      CREATE TRIGGER reject_membership_delete BEFORE DELETE ON workout_exercises
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(addWorkoutSet(database, workoutId, exercise.id)).rejects.toThrow('write failed');
    await expect(removeExerciseFromWorkout(database, workoutId, exercise.id)).rejects.toThrow('write failed');
    expect(await loadActiveWorkout(database)).toEqual({ id: workoutId, exercises: [exercise] });
  });

  test('rolls back a failed confirmation without false success', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const setId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;
    await database.execAsync(`
      CREATE TRIGGER reject_set_confirmation BEFORE UPDATE ON workout_sets
      WHEN NEW.confirmed_at IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(confirmWorkoutSet(database, workoutId, setId, 80, 5, 'now')).rejects.toThrow('write failed');
    expect((await loadActiveWorkout(database))!.exercises[0].sets[0]).toEqual({
      id: setId, loadKg: null, repetitions: null, confirmedAt: null,
    });
  });

  test('keeps the previous planned values when autosave fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const workoutId = await startWorkout(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await addExerciseToWorkout(database, workoutId, exerciseId);
    const setId = (await loadActiveWorkout(database))!.exercises[0].sets[0].id;
    await savePlannedWorkoutSet(database, workoutId, setId, 80, 5);
    await database.execAsync(`
      CREATE TRIGGER reject_planned_set_save BEFORE UPDATE ON workout_sets
      WHEN NEW.confirmed_at IS NULL
      BEGIN SELECT RAISE(ABORT, 'write failed'); END;
    `);

    await expect(savePlannedWorkoutSet(database, workoutId, setId, 90, 3)).rejects.toThrow('write failed');
    expect((await loadActiveWorkout(database))!.exercises[0].sets[0]).toEqual({
      id: setId, loadKg: 80, repetitions: 5, confirmedAt: null,
    });
  });
});
