import { exerciseNameKey, validateExerciseName } from '../domain/exerciseName';
import { DEFAULT_TRAINING_CONTEXT_NAME } from './schema';
import { databaseOperation, type Database } from './types';

export const DUPLICATE_TRAINING_CONTEXT_NAME = 'En kontekst med dette navnet finnes allerede';

export interface TrainingContextListItem {
  id: number;
  name: string;
  workoutCount: number;
}

export interface TrainingContextDetail extends TrainingContextListItem {
  /** Exercise names from the latest completed treningsøkt in the kontekst, in workout order. */
  lastExercises: string[];
}

type TrainingContextRow = { id: number; name: string; workout_count: number };

const bokmalCollator = new Intl.Collator('nb', { sensitivity: 'accent' });

/** Creates the default kontekst "Standard" and returns its id. */
export async function insertDefaultTrainingContext(database: Database): Promise<number> {
  return (await database.runAsync(
    'INSERT INTO training_contexts (name, name_key, created_at) VALUES (?, ?, ?)',
    DEFAULT_TRAINING_CONTEXT_NAME,
    exerciseNameKey(DEFAULT_TRAINING_CONTEXT_NAME),
    new Date().toISOString(),
  )).lastInsertRowId;
}

function assertNormalized(name: string, key: string) {
  const validated = validateExerciseName(name);
  if ('error' in validated || validated.name !== name || validated.key !== key) {
    throw new Error('Training context name must use its normalized identity');
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return /unique/i.test(error instanceof Error ? error.message : String(error));
}

const TRAINING_CONTEXT_SELECT = `
  SELECT training_contexts.id, training_contexts.name,
    (SELECT COUNT(*) FROM workouts
      WHERE workouts.training_context_id = training_contexts.id
        AND workouts.status = 'completed') AS workout_count
  FROM training_contexts
`;

function toListItem(row: TrainingContextRow): TrainingContextListItem {
  return { id: row.id, name: row.name, workoutCount: row.workout_count };
}

async function listTrainingContextsWithDatabase(database: Database): Promise<TrainingContextListItem[]> {
  const rows = await database.getAllAsync<TrainingContextRow>(TRAINING_CONTEXT_SELECT);
  return rows
    .map(toListItem)
    .sort((left, right) => bokmalCollator.compare(left.name, right.name) || left.id - right.id);
}

async function createTrainingContextWithDatabase(
  database: Database,
  name: string,
  key: string,
): Promise<number> {
  assertNormalized(name, key);
  const existing = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM training_contexts WHERE name_key = ?',
    key,
  );
  if (existing) throw new DuplicateTrainingContextNameError();
  try {
    return (await database.runAsync(
      'INSERT INTO training_contexts (name, name_key, created_at) VALUES (?, ?, ?)',
      name,
      key,
      new Date().toISOString(),
    )).lastInsertRowId;
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DuplicateTrainingContextNameError();
    throw error;
  }
}

async function renameTrainingContextWithDatabase(
  database: Database,
  trainingContextId: number,
  name: string,
  key: string,
): Promise<void> {
  assertNormalized(name, key);
  const duplicate = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM training_contexts WHERE name_key = ? AND id <> ?',
    key,
    trainingContextId,
  );
  if (duplicate) throw new DuplicateTrainingContextNameError();
  let changes: number;
  try {
    changes = (await database.runAsync(
      'UPDATE training_contexts SET name = ?, name_key = ? WHERE id = ?',
      name,
      key,
      trainingContextId,
    )).changes;
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DuplicateTrainingContextNameError();
    throw error;
  }
  if (changes !== 1) throw new TrainingContextNotFoundError();
}

async function loadLastTrainingContextExercisesWithDatabase(
  database: Database,
  trainingContextId: number,
): Promise<string[]> {
  const rows = await database.getAllAsync<{ name: string }>(`
    SELECT exercises.name
    FROM workout_exercises
    JOIN exercises ON exercises.id = workout_exercises.exercise_id
    WHERE workout_exercises.workout_id = (
      SELECT id FROM workouts
      WHERE training_context_id = ? AND status = 'completed'
      ORDER BY completed_at DESC, id ASC LIMIT 1
    )
    ORDER BY workout_exercises.position ASC
  `, trainingContextId);
  return rows.map((row) => row.name);
}

async function loadTrainingContextDetailWithDatabase(
  database: Database,
  trainingContextId: number,
): Promise<TrainingContextDetail | null> {
  const row = await database.getFirstAsync<TrainingContextRow>(
    `${TRAINING_CONTEXT_SELECT} WHERE training_contexts.id = ?`,
    trainingContextId,
  );
  if (!row) return null;
  return {
    ...toListItem(row),
    lastExercises: await loadLastTrainingContextExercisesWithDatabase(database, trainingContextId),
  };
}

export class DuplicateTrainingContextNameError extends Error {
  constructor() {
    super(DUPLICATE_TRAINING_CONTEXT_NAME);
    this.name = 'DuplicateTrainingContextNameError';
  }
}

export class TrainingContextNotFoundError extends Error {
  constructor() {
    super('Training context not found');
    this.name = 'TrainingContextNotFoundError';
  }
}

export const listTrainingContexts = databaseOperation(listTrainingContextsWithDatabase);
export const createTrainingContext = databaseOperation(createTrainingContextWithDatabase);
export const renameTrainingContext = databaseOperation(renameTrainingContextWithDatabase);
export const loadLastTrainingContextExercises = databaseOperation(loadLastTrainingContextExercisesWithDatabase);
export const loadTrainingContextDetail = databaseOperation(loadTrainingContextDetailWithDatabase);
