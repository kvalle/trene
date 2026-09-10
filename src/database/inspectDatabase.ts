import { sha256 } from '@noble/hashes/sha256';

import { exerciseNameKey, validateExerciseName } from '../domain/exerciseName';
import { isCanonicalTimestamp } from '../domain/timestamp';
import { isValidLoad, isValidRepetitions } from '../domain/workoutSet';
import { SCHEMA_VERSION, VERSION_ONE_SQL } from './schema';
import { databaseOperation, type Database } from './types';

export const AUTHORITATIVE_TABLES = [
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
] as const;

type AuthoritativeTable = typeof AUTHORITATIVE_TABLES[number];

export interface DatabaseInspection {
  schemaVersion: number;
  tableCounts: Record<AuthoritativeTable, number>;
  previewCounts: { workouts: number; exercises: number };
  semanticDigest: string;
}

export type DatabaseInspectionErrorCode =
  | 'unsupported-schema'
  | 'integrity-failed'
  | 'foreign-key-failed'
  | 'schema-mismatch'
  | 'invalid-data';

export class DatabaseInspectionError extends Error {
  constructor(
    public readonly code: DatabaseInspectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DatabaseInspectionError';
  }
}

type SchemaRow = { type: string; name: string; sql: string | null };
type ExerciseRow = { id: unknown; name: unknown; name_key: unknown; created_at: unknown };
type WorkoutRow = {
  id: unknown;
  status: unknown;
  started_at: unknown;
  completed_at: unknown;
};
type WorkoutExerciseRow = { id: unknown; workout_id: unknown; exercise_id: unknown; position: unknown };
type SetRow = {
  id: unknown;
  workout_exercise_id: unknown;
  load_kg: unknown;
  repetitions: unknown;
  confirmed_at: unknown;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/gu, ' ').replace(/\s*;\s*$/u, '').trim();
}

function expectedSchemaObjects(): (readonly [string, string, string])[] {
  return VERSION_ONE_SQL.split(';').map((statement) => normalizeSql(statement)).filter(Boolean)
    .map((sql) => {
      const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX) ([a-z_]+)/iu.exec(sql);
      if (!match) throw new Error(`Unsupported schema statement: ${sql}`);
      return [match[1].toLowerCase(), match[2], sql] as const;
    }).sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]));
}

function invalid(message: string): never {
  throw new DatabaseInspectionError('invalid-data', message);
}

function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

async function inspectDatabaseWithConnection(database: Database): Promise<DatabaseInspection> {
  await database.execAsync('PRAGMA trusted_schema = OFF;');
  const version = (await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;',
  ))?.user_version ?? 0;
  if (version !== SCHEMA_VERSION) {
    throw new DatabaseInspectionError('unsupported-schema', `Unsupported schema version: ${version}`);
  }

  let integrity: { integrity_check: string }[];
  try {
    integrity = await database.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
  } catch {
    throw new DatabaseInspectionError('integrity-failed', 'SQLite integrity check failed');
  }
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new DatabaseInspectionError('integrity-failed', 'SQLite integrity check failed');
  }
  if ((await database.getAllAsync('PRAGMA foreign_key_check;')).length !== 0) {
    throw new DatabaseInspectionError('foreign-key-failed', 'SQLite foreign-key check failed');
  }

  const actualSchema = (await database.getAllAsync<SchemaRow>(`
    SELECT type, name, sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
    ORDER BY type, name
  `)).map((row) => [row.type, row.name, normalizeSql(row.sql!)] as const);
  const expectedSchema = expectedSchemaObjects();
  if (JSON.stringify(actualSchema) !== JSON.stringify(expectedSchema)) {
    throw new DatabaseInspectionError('schema-mismatch', 'Database structure does not match schema version 1');
  }

  const exercises = await database.getAllAsync<ExerciseRow>(
    'SELECT id, name, name_key, created_at FROM exercises ORDER BY id',
  );
  for (const exercise of exercises) {
    if (!validId(exercise.id) || typeof exercise.name !== 'string'
      || typeof exercise.name_key !== 'string' || !isCanonicalTimestamp(exercise.created_at)) {
      invalid('Exercise contains invalid values');
    }
    const validated = validateExerciseName(exercise.name);
    if ('error' in validated || validated.name !== exercise.name
      || exerciseNameKey(exercise.name) !== exercise.name_key) {
      invalid('Exercise name is not normalized');
    }
  }

  const workouts = await database.getAllAsync<WorkoutRow>(
    'SELECT id, status, started_at, completed_at FROM workouts ORDER BY id',
  );
  const workoutById = new Map<number, WorkoutRow>();
  for (const workout of workouts) {
    if (!validId(workout.id) || !isCanonicalTimestamp(workout.started_at)
      || (workout.status !== 'active' && workout.status !== 'completed')) {
      invalid('Workout contains invalid values');
    }
    if (workout.status === 'active' && workout.completed_at !== null) {
      invalid('Active workout has a completion time');
    }
    if (workout.status === 'completed'
      && (!isCanonicalTimestamp(workout.completed_at)
        || Date.parse(workout.completed_at) < Date.parse(workout.started_at))) {
      invalid('Completed workout has invalid timestamp ordering');
    }
    workoutById.set(workout.id, workout);
  }

  const workoutExercises = await database.getAllAsync<WorkoutExerciseRow>(
    'SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY workout_id, position',
  );
  const workoutExerciseById = new Map<number, WorkoutExerciseRow>();
  const nextPosition = new Map<number, number>();
  for (const workoutExercise of workoutExercises) {
    if (!validId(workoutExercise.id) || !validId(workoutExercise.workout_id)
      || !validId(workoutExercise.exercise_id) || !Number.isSafeInteger(workoutExercise.position)
      || workoutExercise.position !== (nextPosition.get(workoutExercise.workout_id) ?? 0)) {
      invalid('Workout exercise positions are not contiguous');
    }
    nextPosition.set(workoutExercise.workout_id, workoutExercise.position + 1);
    workoutExerciseById.set(workoutExercise.id, workoutExercise);
  }
  const workoutIdsWithExercises = new Set(
    workoutExercises.map((workoutExercise) => workoutExercise.workout_id).filter(validId),
  );
  for (const workout of workouts) {
    if (workout.status === 'completed' && validId(workout.id)
      && !workoutIdsWithExercises.has(workout.id)) {
      invalid('Completed workout contains no exercises');
    }
  }

  const sets = await database.getAllAsync<SetRow>(`
    SELECT id, workout_exercise_id, load_kg, repetitions, confirmed_at
    FROM workout_sets ORDER BY id
  `);
  const completedWorkoutExercises = new Set<number>();
  for (const set of sets) {
    if (!validId(set.id) || !validId(set.workout_exercise_id)
      || (set.load_kg !== null && !isValidLoad(set.load_kg))
      || (set.repetitions !== null && !isValidRepetitions(set.repetitions))) {
      invalid('Workout set contains invalid values');
    }
    const workoutExercise = workoutExerciseById.get(set.workout_exercise_id);
    const workout = workoutExercise && validId(workoutExercise.workout_id)
      ? workoutById.get(workoutExercise.workout_id)
      : undefined;
    if (!workoutExercise || !workout) invalid('Workout set has invalid references');
    if (set.confirmed_at === null) {
      if (workout.status === 'completed') invalid('Completed workout contains a planned set');
      continue;
    }
    if (!isCanonicalTimestamp(set.confirmed_at) || set.load_kg === null || set.repetitions === null
      || Date.parse(set.confirmed_at) < Date.parse(workout.started_at as string)
      || (workout.status === 'completed'
        && Date.parse(set.confirmed_at) > Date.parse(workout.completed_at as string))) {
      invalid('Workout set has invalid confirmation state or timestamp ordering');
    }
    completedWorkoutExercises.add(workoutExercise.id as number);
  }
  for (const workoutExercise of workoutExercises) {
    const workout = validId(workoutExercise.workout_id) ? workoutById.get(workoutExercise.workout_id) : undefined;
    if (workout?.status === 'completed' && !completedWorkoutExercises.has(workoutExercise.id as number)) {
      invalid('Completed workout contains an empty exercise');
    }
  }

  const countRows = await Promise.all(AUTHORITATIVE_TABLES.map(async (table) => [
    table,
    (await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0,
  ] as const));
  const tableCounts = Object.fromEntries(countRows) as Record<AuthoritativeTable, number>;
  const previewCounts = await database.getFirstAsync<{ workouts: number; exercises: number }>(`
    SELECT
      (SELECT COUNT(*) FROM workouts) AS workouts,
      (SELECT COUNT(*) FROM exercises) AS exercises
  `);
  if (!previewCounts) invalid('Could not derive preview counts');
  return {
    schemaVersion: version,
    tableCounts,
    previewCounts,
    // Keep the serialized key stable because digests are stored in restore markers.
    semanticDigest: digestSemanticRows({ exercises, workouts, memberships: workoutExercises, sets }),
  };
}

function digestSemanticRows(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const inspectDatabase = databaseOperation(inspectDatabaseWithConnection);
