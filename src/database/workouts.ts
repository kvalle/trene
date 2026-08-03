import { exerciseNameKey } from '../domain/exerciseName';
import { DuplicateExerciseNameError } from './exercises';
import type { Database } from './types';

export interface AvailableExercise {
  id: number;
  name: string;
}

export interface WorkoutSet {
  id: number;
  loadKg: number | null;
  repetitions: number | null;
  confirmedAt: string | null;
}

export interface WorkoutExercise {
  id: number;
  exerciseId: number;
  name: string;
  position: number;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: number;
  exercises: WorkoutExercise[];
}

type WorkoutRow = { id: number };
type ExerciseRow = { id: number; name: string };
type MembershipRow = { id: number; exercise_id: number; name: string; position: number };
type SetRow = {
  id: number;
  workout_exercise_id: number;
  load_kg: number | null;
  repetitions: number | null;
  confirmed_at: string | null;
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

export async function getActiveWorkoutId(database: Database): Promise<number | null> {
  return (await database.getFirstAsync<WorkoutRow>(
    "SELECT id FROM workouts WHERE status = 'active'",
  ))?.id ?? null;
}

export async function startWorkout(database: Database): Promise<number> {
  return transaction(database, async () => {
    const existing = await getActiveWorkoutId(database);
    if (existing !== null) return existing;
    return (await database.runAsync(
      "INSERT INTO workouts (status, started_at) VALUES ('active', ?)",
      new Date().toISOString(),
    )).lastInsertRowId;
  });
}

export async function loadActiveWorkout(database: Database): Promise<ActiveWorkout | null> {
  const id = await getActiveWorkoutId(database);
  if (id === null) return null;
  const memberships = await database.getAllAsync<MembershipRow>(`
    SELECT workout_exercises.id, workout_exercises.exercise_id, exercises.name,
      workout_exercises.position
    FROM workout_exercises
    JOIN exercises ON exercises.id = workout_exercises.exercise_id
    WHERE workout_exercises.workout_id = ?
    ORDER BY workout_exercises.position ASC
  `, id);
  const sets = await database.getAllAsync<SetRow>(`
    SELECT workout_sets.id, workout_sets.workout_exercise_id, workout_sets.load_kg,
      workout_sets.repetitions, workout_sets.confirmed_at
    FROM workout_sets
    JOIN workout_exercises ON workout_exercises.id = workout_sets.workout_exercise_id
    WHERE workout_exercises.workout_id = ?
    ORDER BY workout_sets.confirmed_at IS NULL ASC, workout_sets.confirmed_at ASC,
      workout_sets.id ASC
  `, id);
  return {
    id,
    exercises: memberships.map((membership) => ({
      id: membership.id,
      exerciseId: membership.exercise_id,
      name: membership.name,
      position: membership.position,
      sets: sets.filter((set) => set.workout_exercise_id === membership.id).map((set) => ({
        id: set.id,
        loadKg: set.load_kg,
        repetitions: set.repetitions,
        confirmedAt: set.confirmed_at,
      })),
    })),
  };
}

export async function listAvailableExercises(
  database: Database,
  workoutId: number,
): Promise<AvailableExercise[]> {
  const rows = await database.getAllAsync<ExerciseRow>(`
    SELECT exercises.id, exercises.name FROM exercises
    WHERE NOT EXISTS (
      SELECT 1 FROM workout_exercises
      WHERE workout_exercises.workout_id = ?
        AND workout_exercises.exercise_id = exercises.id
    )
  `, workoutId);
  return rows.sort((left, right) => bokmalCollator.compare(left.name, right.name) || left.id - right.id);
}

export async function countExercises(database: Database): Promise<number> {
  return (await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises',
  ))?.count ?? 0;
}

async function addMembership(database: Database, workoutId: number, exerciseId: number) {
  const active = await database.getFirstAsync<WorkoutRow>(
    "SELECT id FROM workouts WHERE id = ? AND status = 'active'", workoutId,
  );
  if (!active) throw new Error('Active workout not found');
  const position = (await database.getFirstAsync<{ position: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM workout_exercises WHERE workout_id = ?',
    workoutId,
  ))?.position ?? 0;
  const membershipId = (await database.runAsync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
    workoutId, exerciseId, position,
  )).lastInsertRowId;
  const historySets = await database.getAllAsync<{ load_kg: number; repetitions: number }>(`
    SELECT workout_sets.load_kg, workout_sets.repetitions
    FROM workout_sets
    JOIN workout_exercises ON workout_exercises.id = workout_sets.workout_exercise_id
    JOIN workouts ON workouts.id = workout_exercises.workout_id
    WHERE workout_exercises.exercise_id = ?
      AND workouts.id = (
        SELECT history.id FROM workouts AS history
        JOIN workout_exercises AS history_exercise ON history_exercise.workout_id = history.id
        JOIN workout_sets AS history_set ON history_set.workout_exercise_id = history_exercise.id
        WHERE history.status = 'completed' AND history_exercise.exercise_id = ?
          AND history_set.confirmed_at IS NOT NULL
        ORDER BY history.completed_at DESC, history.id ASC LIMIT 1
      )
      AND workout_sets.confirmed_at IS NOT NULL
    ORDER BY workout_sets.confirmed_at ASC, workout_sets.id ASC
  `, exerciseId, exerciseId);
  if (historySets.length === 0) {
    await database.runAsync('INSERT INTO workout_sets (workout_exercise_id) VALUES (?)', membershipId);
  } else {
    for (const set of historySets) {
      await database.runAsync(
        'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, ?, ?)',
        membershipId, set.load_kg, set.repetitions,
      );
    }
  }
}

export async function addExerciseToWorkout(
  database: Database,
  workoutId: number,
  exerciseId: number,
): Promise<void> {
  await transaction(database, () => addMembership(database, workoutId, exerciseId));
}

export async function createExerciseInWorkout(
  database: Database,
  workoutId: number,
  name: string,
  key = exerciseNameKey(name),
): Promise<number> {
  try {
    return await transaction(database, async () => {
      const exerciseId = (await database.runAsync(
        'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
        name, key, new Date().toISOString(),
      )).lastInsertRowId;
      await addMembership(database, workoutId, exerciseId);
      return exerciseId;
    });
  } catch (error) {
    if (/unique/i.test(error instanceof Error ? error.message : String(error))) {
      throw new DuplicateExerciseNameError();
    }
    throw error;
  }
}
