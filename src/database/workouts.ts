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

export interface CompletedWorkout extends ActiveWorkout {
  completedAt: string;
}

export interface CompletedWorkoutListItem {
  id: number;
  completedAt: string;
  exerciseCount: number;
}

export interface CompletedWorkoutDeletion {
  focusWorkoutId: number | null;
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

export async function cancelActiveWorkout(database: Database, workoutId: number): Promise<void> {
  await transaction(database, async () => {
    const result = await database.runAsync(
      "DELETE FROM workouts WHERE id = ? AND status = 'active'",
      workoutId,
    );
    if (result.changes !== 1) throw new Error('Active workout not found');
  });
}

export async function deleteCompletedWorkout(
  database: Database,
  workoutId: number,
): Promise<CompletedWorkoutDeletion> {
  return transaction(database, async () => {
    const workouts = await database.getAllAsync<WorkoutRow>(`
      SELECT id FROM workouts WHERE status = 'completed'
      ORDER BY completed_at DESC, id ASC
    `);
    const index = workouts.findIndex((workout) => workout.id === workoutId);
    if (index === -1) throw new Error('Completed workout not found');

    const result = await database.runAsync(
      "DELETE FROM workouts WHERE id = ? AND status = 'completed'",
      workoutId,
    );
    if (result.changes !== 1) throw new Error('Completed workout not found');
    return { focusWorkoutId: workouts[index - 1]?.id ?? workouts[index + 1]?.id ?? null };
  });
}

export async function completeWorkout(
  database: Database,
  workoutId: number,
  completedAt = new Date().toISOString(),
): Promise<void> {
  await transaction(database, async () => {
    await database.runAsync(`
      DELETE FROM workout_sets WHERE confirmed_at IS NULL
        AND workout_exercise_id IN (
          SELECT id FROM workout_exercises WHERE workout_id = ?
        )
    `, workoutId);
    await database.runAsync(`
      DELETE FROM workout_exercises WHERE workout_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM workout_sets
          WHERE workout_sets.workout_exercise_id = workout_exercises.id
        )
    `, workoutId);
    const result = await database.runAsync(`
      UPDATE workouts SET status = 'completed', completed_at = ?
      WHERE id = ? AND status = 'active'
        AND EXISTS (
          SELECT 1 FROM workout_exercises
          JOIN workout_sets ON workout_sets.workout_exercise_id = workout_exercises.id
          WHERE workout_exercises.workout_id = workouts.id
            AND workout_sets.confirmed_at IS NOT NULL
        )
    `, completedAt, workoutId);
    if (result.changes !== 1) throw new Error('Completable workout not found');
  });
}

async function updateActiveWorkoutSet(
  database: Database,
  assignments: string,
  condition: string,
  ...params: (number | string | null)[]
): Promise<void> {
  const result = await database.runAsync(`
    UPDATE workout_sets SET ${assignments}
    WHERE workout_sets.id = ? ${condition}
      AND EXISTS (
        SELECT 1 FROM workout_exercises
        JOIN workouts ON workouts.id = workout_exercises.workout_id
        WHERE workout_exercises.id = workout_sets.workout_exercise_id
          AND workouts.id = ? AND workouts.status = 'active'
      )
  `, ...params);
  if (result.changes !== 1) throw new Error('Workout set not found');
}

export async function savePlannedWorkoutSet(
  database: Database,
  workoutId: number,
  setId: number,
  loadKg: number | null,
  repetitions: number | null,
): Promise<void> {
  await transaction(database, () => updateActiveWorkoutSet(
    database,
    'load_kg = ?, repetitions = ?', 'AND confirmed_at IS NULL',
    loadKg, repetitions, setId, workoutId,
  ));
}

export async function confirmWorkoutSet(
  database: Database,
  workoutId: number,
  setId: number,
  loadKg: number,
  repetitions: number,
  confirmedAt = new Date().toISOString(),
): Promise<void> {
  await transaction(database, () => updateActiveWorkoutSet(
    database,
    'load_kg = ?, repetitions = ?, confirmed_at = ?', 'AND confirmed_at IS NULL',
    loadKg, repetitions, confirmedAt, setId, workoutId,
  ));
}

export async function unconfirmWorkoutSet(
  database: Database,
  workoutId: number,
  setId: number,
): Promise<void> {
  await transaction(database, () => updateActiveWorkoutSet(
    database, 'confirmed_at = NULL', 'AND confirmed_at IS NOT NULL', setId, workoutId,
  ));
}

export async function deletePlannedWorkoutSet(
  database: Database,
  workoutId: number,
  setId: number,
): Promise<void> {
  await transaction(database, async () => {
    const result = await database.runAsync(`
      DELETE FROM workout_sets WHERE id = ? AND confirmed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM workout_exercises
          JOIN workouts ON workouts.id = workout_exercises.workout_id
          WHERE workout_exercises.id = workout_sets.workout_exercise_id
            AND workouts.id = ? AND workouts.status = 'active'
        )
    `, setId, workoutId);
    if (result.changes !== 1) throw new Error('Planned set not found');
  });
}

export async function addWorkoutSet(
  database: Database,
  workoutId: number,
  workoutExerciseId: number,
): Promise<WorkoutSet> {
  return transaction(database, async () => {
    const membership = await database.getFirstAsync<{ id: number }>(`
      SELECT workout_exercises.id FROM workout_exercises
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workout_exercises.id = ? AND workouts.id = ? AND workouts.status = 'active'
    `, workoutExerciseId, workoutId);
    if (!membership) throw new Error('Active workout exercise not found');

    const source = await database.getFirstAsync<{ load_kg: number; repetitions: number }>(`
      SELECT load_kg, repetitions FROM workout_sets
      WHERE workout_exercise_id = ? AND confirmed_at IS NOT NULL
      ORDER BY confirmed_at DESC, id DESC LIMIT 1
    `, workoutExerciseId) ?? await database.getFirstAsync<{ load_kg: number | null; repetitions: number | null }>(`
      SELECT load_kg, repetitions FROM workout_sets
      WHERE workout_exercise_id = ? AND confirmed_at IS NULL
      ORDER BY id DESC LIMIT 1
    `, workoutExerciseId);
    const validSource = source?.load_kg !== null && source?.repetitions !== null ? source : null;
    const result = await database.runAsync(
      'INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions) VALUES (?, ?, ?)',
      workoutExerciseId, validSource?.load_kg ?? null, validSource?.repetitions ?? null,
    );
    return {
      id: result.lastInsertRowId,
      loadKg: validSource?.load_kg ?? null,
      repetitions: validSource?.repetitions ?? null,
      confirmedAt: null,
    };
  });
}

export async function removeExerciseFromWorkout(
  database: Database,
  workoutId: number,
  workoutExerciseId: number,
): Promise<void> {
  await transaction(database, async () => {
    const result = await database.runAsync(`
      DELETE FROM workout_exercises WHERE id = ? AND workout_id = ?
        AND EXISTS (SELECT 1 FROM workouts WHERE id = ? AND status = 'active')
    `, workoutExerciseId, workoutId, workoutId);
    if (result.changes !== 1) throw new Error('Active workout exercise not found');
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

export async function loadCompletedWorkout(
  database: Database,
  workoutId: number,
): Promise<CompletedWorkout | null> {
  const workout = await database.getFirstAsync<{ id: number; completed_at: string }>(
    "SELECT id, completed_at FROM workouts WHERE id = ? AND status = 'completed'",
    workoutId,
  );
  if (!workout) return null;
  const memberships = await database.getAllAsync<MembershipRow>(`
    SELECT workout_exercises.id, workout_exercises.exercise_id, exercises.name,
      workout_exercises.position
    FROM workout_exercises
    JOIN exercises ON exercises.id = workout_exercises.exercise_id
    WHERE workout_exercises.workout_id = ?
    ORDER BY workout_exercises.position ASC
  `, workoutId);
  const sets = await database.getAllAsync<SetRow>(`
    SELECT workout_sets.id, workout_sets.workout_exercise_id, workout_sets.load_kg,
      workout_sets.repetitions, workout_sets.confirmed_at
    FROM workout_sets
    JOIN workout_exercises ON workout_exercises.id = workout_sets.workout_exercise_id
    WHERE workout_exercises.workout_id = ? AND workout_sets.confirmed_at IS NOT NULL
    ORDER BY workout_sets.confirmed_at ASC, workout_sets.id ASC
  `, workoutId);
  return {
    id: workout.id,
    completedAt: workout.completed_at,
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

export async function listCompletedWorkouts(database: Database): Promise<CompletedWorkoutListItem[]> {
  const rows = await database.getAllAsync<{
    id: number;
    completed_at: string;
    exercise_count: number;
  }>(`
    SELECT workouts.id, workouts.completed_at,
      COUNT(workout_exercises.id) AS exercise_count
    FROM workouts
    LEFT JOIN workout_exercises ON workout_exercises.workout_id = workouts.id
      AND EXISTS (
        SELECT 1 FROM workout_sets
        WHERE workout_sets.workout_exercise_id = workout_exercises.id
          AND workout_sets.confirmed_at IS NOT NULL
      )
    WHERE workouts.status = 'completed'
    GROUP BY workouts.id
    ORDER BY workouts.completed_at DESC, workouts.id ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    completedAt: row.completed_at,
    exerciseCount: row.exercise_count,
  }));
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
    WHERE workout_sets.workout_exercise_id = (
      SELECT history_exercise.id FROM workouts AS history
      JOIN workout_exercises AS history_exercise ON history_exercise.workout_id = history.id
      JOIN workout_sets AS history_set ON history_set.workout_exercise_id = history_exercise.id
      WHERE history.status = 'completed' AND history_exercise.exercise_id = ?
        AND history_set.confirmed_at IS NOT NULL
      ORDER BY history.completed_at DESC, history.id ASC LIMIT 1
    ) AND workout_sets.confirmed_at IS NOT NULL
    ORDER BY workout_sets.confirmed_at ASC, workout_sets.id ASC
  `, exerciseId);
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
