import { exerciseNameKey } from '../domain/exerciseName';
import type { Database } from './types';

export const DUPLICATE_EXERCISE_NAME = 'En øvelse med dette navnet finnes allerede';

export interface ExerciseListItem {
  id: number;
  name: string;
  workoutCount: number;
}

type ExerciseRow = {
  id: number;
  name: string;
  workout_count: number;
};

const bokmalCollator = new Intl.Collator('nb', { sensitivity: 'accent' });

export async function listExercises(database: Database): Promise<ExerciseListItem[]> {
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

export async function createExercise(
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

export class DuplicateExerciseNameError extends Error {
  constructor() {
    super(DUPLICATE_EXERCISE_NAME);
    this.name = 'DuplicateExerciseNameError';
  }
}
