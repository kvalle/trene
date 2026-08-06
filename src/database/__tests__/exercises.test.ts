import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import { deleteCompletedWorkout } from '../workouts';
import {
  createExercise,
  deleteExercise,
  DuplicateExerciseNameError,
  ExerciseDeletionIneligibleError,
  ExerciseNotFoundError,
  listExercises,
  loadExerciseDetail,
  renameExercise,
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

async function addWorkout(
  database: Database,
  exerciseId: number,
  status: 'active' | 'completed',
  completedAt: string | null,
) {
  const workout = await database.runAsync(
    'INSERT INTO workouts (status, started_at, completed_at) VALUES (?, ?, ?)',
    status, 'started', completedAt,
  );
  const membership = await database.runAsync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
    workout.lastInsertRowId, exerciseId,
  );
  return { workoutId: workout.lastInsertRowId, membershipId: membership.lastInsertRowId };
}

async function addSet(
  database: Database,
  membershipId: number,
  loadKg: number | null,
  repetitions: number | null,
  confirmedAt: string | null,
) {
  return (await database.runAsync(
    `INSERT INTO workout_sets
      (workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, ?, ?, ?)`,
    membershipId, loadKg, repetitions, confirmedAt,
  )).lastInsertRowId;
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

  test('loads current identity and groups only confirmed completed history deterministically', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));
    const first = await addWorkout(database, exerciseId, 'completed', '2026-02-02T10:00:00Z');
    const second = await addWorkout(database, exerciseId, 'completed', '2026-02-02T10:00:00Z');
    const older = await addWorkout(database, exerciseId, 'completed', '2026-01-01T10:00:00Z');
    const active = await addWorkout(database, exerciseId, 'active', null);
    const firstSet = await addSet(database, first.membershipId, 80, 5, 'same');
    const secondSet = await addSet(database, first.membershipId, 90, 3, 'same');
    await addSet(database, first.membershipId, null, null, null);
    const tiedWorkoutSet = await addSet(database, second.membershipId, 100, 1, 'later');
    const olderSet = await addSet(database, older.membershipId, 70, 8, 'old');
    await addSet(database, active.membershipId, 120, 1, 'active-confirmed');

    expect(await loadExerciseDetail(database, exerciseId)).toEqual({
      id: exerciseId,
      name: 'Markløft',
      canDelete: false,
      history: [
        {
          id: first.workoutId,
          completedAt: '2026-02-02T10:00:00Z',
          sets: [
            { id: firstSet, loadKg: 80, repetitions: 5, confirmedAt: 'same' },
            { id: secondSet, loadKg: 90, repetitions: 3, confirmedAt: 'same' },
          ],
        },
        {
          id: second.workoutId,
          completedAt: '2026-02-02T10:00:00Z',
          sets: [{ id: tiedWorkoutSet, loadKg: 100, repetitions: 1, confirmedAt: 'later' }],
        },
        {
          id: older.workoutId,
          completedAt: '2026-01-01T10:00:00Z',
          sets: [{ id: olderSet, loadKg: 70, repetitions: 8, confirmedAt: 'old' }],
        },
      ],
    });
    await expect(loadExerciseDetail(database, 999)).resolves.toBeNull();
  });

  test('reports deletion eligibility for active and completed references, even without confirmed sets', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const freeId = await createExercise(database, 'Fri', exerciseNameKey('Fri'));
    const activeId = await createExercise(database, 'Aktiv', exerciseNameKey('Aktiv'));
    const completedId = await createExercise(database, 'Historisk', exerciseNameKey('Historisk'));
    await addWorkout(database, activeId, 'active', null);
    await addWorkout(database, completedId, 'completed', 'done');

    expect((await loadExerciseDetail(database, freeId))?.canDelete).toBe(true);
    expect((await loadExerciseDetail(database, activeId))?.canDelete).toBe(false);
    expect((await loadExerciseDetail(database, completedId))?.canDelete).toBe(false);
  });

  test('renames with a provided normalized identity and updates history through the stable ID', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const workout = await addWorkout(database, exerciseId, 'completed', 'done');
    await addSet(database, workout.membershipId, 100, 5, 'confirmed');

    await renameExercise(database, exerciseId, '  Ny Knebøy  ', 'provided-key');

    expect(await loadExerciseDetail(database, exerciseId)).toMatchObject({
      id: exerciseId,
      name: '  Ny Knebøy  ',
      history: [{ id: workout.workoutId }],
    });
    expect(await database.getFirstAsync<{ name_key: string }>(
      'SELECT name_key FROM exercises WHERE id = ?', exerciseId,
    )).toEqual({ name_key: 'provided-key' });

    await renameExercise(database, exerciseId, 'NY KNEBØY', 'provided-key');
    expect((await loadExerciseDetail(database, exerciseId))?.name).toBe('NY KNEBØY');
  });

  test('rejects rename duplicates and missing exercises without changing data', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const firstId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await createExercise(database, 'Markløft', exerciseNameKey('Markløft'));

    await expect(renameExercise(database, firstId, 'MARKLØFT', exerciseNameKey('MARKLØFT')))
      .rejects.toBeInstanceOf(DuplicateExerciseNameError);
    await expect(renameExercise(database, 999, 'Ny', exerciseNameKey('Ny')))
      .rejects.toBeInstanceOf(ExerciseNotFoundError);
    expect((await listExercises(database)).map(({ name }) => name)).toEqual(['Knebøy', 'Markløft']);
  });

  test('maps a rename uniqueness race and rolls back every change', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    await database.execAsync(`
      CREATE TRIGGER rename_race BEFORE UPDATE ON exercises
      BEGIN
        INSERT INTO exercises (name, name_key, created_at)
        VALUES ('Rival', NEW.name_key, 'race');
      END;
    `);

    await expect(renameExercise(database, exerciseId, 'Markløft', exerciseNameKey('Markløft')))
      .rejects.toBeInstanceOf(DuplicateExerciseNameError);
    expect(await database.getAllAsync<{ name: string }>('SELECT name FROM exercises'))
      .toEqual([{ name: 'Knebøy' }]);
    await database.execAsync('DROP TRIGGER rename_race;');
    await renameExercise(database, exerciseId, 'Markløft', exerciseNameKey('Markløft'));
  });

  test('deletes atomically and selects the next Bokmål exercise, then previous, then null', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const zId = await createExercise(database, 'Z-press', exerciseNameKey('Z-press'));
    const aId = await createExercise(database, 'Abe', exerciseNameKey('Abe'));
    const aaId = await createExercise(database, 'Åløft', exerciseNameKey('Åløft'));

    await expect(deleteExercise(database, zId)).resolves.toEqual({ focusExerciseId: aaId });
    await expect(deleteExercise(database, aaId)).resolves.toEqual({ focusExerciseId: aId });
    await expect(deleteExercise(database, aId)).resolves.toEqual({ focusExerciseId: null });
    expect(await listExercises(database)).toEqual([]);
  });

  test('distinguishes missing and newly ineligible deletion and rolls back the racing reference', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    let raced = false;
    const racingDatabase: Database = {
      closeAsync: () => database.closeAsync(),
      execAsync: (source) => database.execAsync(source),
      getAllAsync: (source, ...params) => database.getAllAsync(source, ...params),
      getFirstAsync: (source, ...params) => database.getFirstAsync(source, ...params),
      runAsync: async (source, ...params) => {
        if (!raced && /^\s*DELETE FROM exercises/.test(source)) {
          raced = true;
          await addWorkout(database, exerciseId, 'completed', 'race');
        }
        return database.runAsync(source, ...params);
      },
    };

    await expect(deleteExercise(racingDatabase, exerciseId))
      .rejects.toBeInstanceOf(ExerciseDeletionIneligibleError);
    expect(await loadExerciseDetail(database, exerciseId)).toMatchObject({ canDelete: true });
    await expect(deleteExercise(database, 999)).rejects.toBeInstanceOf(ExerciseNotFoundError);
  });

  test('rolls back an eligible deletion when a later transaction step fails', async () => {
    const database = new TestDatabase();
    await migrateDatabase(database);
    const exerciseId = await createExercise(database, 'Knebøy', exerciseNameKey('Knebøy'));
    const failingDatabase: Database = {
      closeAsync: () => database.closeAsync(),
      getAllAsync: (source, ...params) => database.getAllAsync(source, ...params),
      getFirstAsync: (source, ...params) => database.getFirstAsync(source, ...params),
      runAsync: (source, ...params) => database.runAsync(source, ...params),
      execAsync: async (source) => {
        if (source === 'COMMIT;') throw new Error('commit failed');
        return database.execAsync(source);
      },
    };

    await expect(deleteExercise(failingDatabase, exerciseId)).rejects.toThrow('commit failed');
    expect(await loadExerciseDetail(database, exerciseId)).toMatchObject({ id: exerciseId });
  });
});
