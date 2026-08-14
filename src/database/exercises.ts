import { exerciseNameKey } from '../domain/exerciseName';
import { databaseOperation, type Database } from './types';

export const DUPLICATE_EXERCISE_NAME = 'En øvelse med dette navnet finnes allerede';

export interface ExerciseListItem {
  id: number;
  name: string;
  workoutCount: number;
}

export interface ExerciseHistorySet {
  id: number;
  loadKg: number;
  repetitions: number;
  confirmedAt: string;
}

export interface ExerciseHistoryWorkout {
  id: number;
  completedAt: string;
  sets: ExerciseHistorySet[];
}

export interface ExerciseDetail {
  id: number;
  name: string;
  canDelete: boolean;
  history: ExerciseHistoryWorkout[];
}

export interface ExerciseDeletion {
  focusExerciseId: number | null;
}

type ExerciseRow = {
  id: number;
  name: string;
  workout_count: number;
};

type ExerciseHistoryRow = {
  workout_id: number;
  completed_at: string;
  set_id: number;
  load_kg: number;
  repetitions: number;
  confirmed_at: string;
};

const bokmalCollator = new Intl.Collator('nb', { sensitivity: 'accent' });

async function transaction<T>(database: Database, operation: () => Promise<T>): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    const result = await operation();
    await database.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return /unique/i.test(error instanceof Error ? error.message : String(error));
}

async function listExercisesWithDatabase(database: Database): Promise<ExerciseListItem[]> {
  const rows = await database.getAllAsync<ExerciseRow>(`
    SELECT
      exercises.id,
      exercises.name,
      COUNT(DISTINCT CASE WHEN workout_sets.id IS NOT NULL THEN workouts.id END) AS workout_count
    FROM exercises
    LEFT JOIN workout_exercises
      ON workout_exercises.exercise_id = exercises.id
    LEFT JOIN workouts
      ON workouts.id = workout_exercises.workout_id
      AND workouts.status = 'completed'
    LEFT JOIN workout_sets
      ON workout_sets.workout_exercise_id = workout_exercises.id
      AND workout_sets.confirmed_at IS NOT NULL
    GROUP BY exercises.id, exercises.name
  `);

  return rows
    .map((row) => ({ id: row.id, name: row.name, workoutCount: row.workout_count }))
    .sort((left, right) => bokmalCollator.compare(left.name, right.name) || left.id - right.id);
}

export function searchExercises(
  exercises: ExerciseListItem[],
  query: string,
): ExerciseListItem[] {
  const key = exerciseNameKey(query);
  return key.length === 0
    ? exercises
    : exercises.filter((exercise) => exerciseNameKey(exercise.name).includes(key));
}

async function createExerciseWithDatabase(
  database: Database,
  name: string,
  key: string,
): Promise<number> {
  const existing = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM exercises WHERE name_key = ?',
    key,
  );
  if (existing) throw new DuplicateExerciseNameError();

  try {
    const result = await database.runAsync(
      'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
      name,
      key,
      new Date().toISOString(),
    );
    return result.lastInsertRowId;
  } catch (error) {
    if (/unique/i.test(error instanceof Error ? error.message : String(error))) {
      throw new DuplicateExerciseNameError();
    }
    throw error;
  }
}

async function loadExerciseDetailWithDatabase(
  database: Database,
  exerciseId: number,
): Promise<ExerciseDetail | null> {
  const exercise = await database.getFirstAsync<{ id: number; name: string; can_delete: number }>(`
    SELECT exercises.id, exercises.name,
      NOT EXISTS (
        SELECT 1 FROM workout_exercises
        JOIN workouts ON workouts.id = workout_exercises.workout_id
        WHERE workout_exercises.exercise_id = exercises.id
          AND workouts.status IN ('active', 'completed')
      ) AS can_delete
    FROM exercises
    WHERE exercises.id = ?
  `, exerciseId);
  if (!exercise) return null;

  const rows = await database.getAllAsync<ExerciseHistoryRow>(`
    SELECT workouts.id AS workout_id, workouts.completed_at,
      workout_sets.id AS set_id, workout_sets.load_kg, workout_sets.repetitions,
      workout_sets.confirmed_at
    FROM workouts
    JOIN workout_exercises ON workout_exercises.workout_id = workouts.id
    JOIN workout_sets ON workout_sets.workout_exercise_id = workout_exercises.id
    WHERE workouts.status = 'completed'
      AND workout_exercises.exercise_id = ?
      AND workout_sets.confirmed_at IS NOT NULL
    ORDER BY workouts.completed_at DESC, workouts.id ASC,
      workout_sets.confirmed_at ASC, workout_sets.id ASC
  `, exerciseId);
  const history: ExerciseHistoryWorkout[] = [];
  for (const row of rows) {
    let workout = history[history.length - 1];
    if (!workout || workout.id !== row.workout_id) {
      workout = { id: row.workout_id, completedAt: row.completed_at, sets: [] };
      history.push(workout);
    }
    workout.sets.push({
      id: row.set_id,
      loadKg: row.load_kg,
      repetitions: row.repetitions,
      confirmedAt: row.confirmed_at,
    });
  }
  return {
    id: exercise.id,
    name: exercise.name,
    canDelete: exercise.can_delete === 1,
    history,
  };
}

async function renameExerciseWithDatabase(
  database: Database,
  exerciseId: number,
  name: string,
  key: string,
): Promise<void> {
  try {
    await transaction(database, async () => {
      const exercise = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM exercises WHERE id = ?',
        exerciseId,
      );
      if (!exercise) throw new ExerciseNotFoundError();

      const duplicate = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM exercises WHERE name_key = ? AND id <> ?',
        key,
        exerciseId,
      );
      if (duplicate) throw new DuplicateExerciseNameError();

      const result = await database.runAsync(
        'UPDATE exercises SET name = ?, name_key = ? WHERE id = ?',
        name,
        key,
        exerciseId,
      );
      if (result.changes !== 1) throw new ExerciseNotFoundError();
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DuplicateExerciseNameError();
    throw error;
  }
}

async function deleteExerciseWithDatabase(
  database: Database,
  exerciseId: number,
): Promise<ExerciseDeletion> {
  return transaction(database, async () => {
    const exercises = (await database.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM exercises',
    )).sort((left, right) => bokmalCollator.compare(left.name, right.name) || left.id - right.id);
    const index = exercises.findIndex((exercise) => exercise.id === exerciseId);
    if (index === -1) throw new ExerciseNotFoundError();

    const result = await database.runAsync(`
      DELETE FROM exercises
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1 FROM workout_exercises
          JOIN workouts ON workouts.id = workout_exercises.workout_id
          WHERE workout_exercises.exercise_id = exercises.id
            AND workouts.status IN ('active', 'completed')
        )
    `, exerciseId);
    if (result.changes !== 1) {
      const exists = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM exercises WHERE id = ?',
        exerciseId,
      );
      if (exists) throw new ExerciseDeletionIneligibleError();
      throw new ExerciseNotFoundError();
    }

    return {
      focusExerciseId: exercises[index + 1]?.id ?? exercises[index - 1]?.id ?? null,
    };
  });
}

export class DuplicateExerciseNameError extends Error {
  constructor() {
    super(DUPLICATE_EXERCISE_NAME);
    this.name = 'DuplicateExerciseNameError';
  }
}

export class ExerciseNotFoundError extends Error {
  constructor() {
    super('Exercise not found');
    this.name = 'ExerciseNotFoundError';
  }
}

export class ExerciseDeletionIneligibleError extends Error {
  constructor() {
    super('Exercise is referenced by a workout');
    this.name = 'ExerciseDeletionIneligibleError';
  }
}

export const listExercises = databaseOperation(listExercisesWithDatabase);
export const createExercise = databaseOperation(createExerciseWithDatabase);
export const loadExerciseDetail = databaseOperation(loadExerciseDetailWithDatabase);
export const renameExercise = databaseOperation(renameExerciseWithDatabase);
export const deleteExercise = databaseOperation(deleteExerciseWithDatabase);
