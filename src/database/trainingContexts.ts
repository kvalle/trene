import { exerciseNameKey, validateExerciseName } from '../domain/exerciseName';
import { DEFAULT_TRAINING_CONTEXT_NAME } from './schema';
import { databaseOperation, type Database } from './types';

export const DUPLICATE_TRAINING_CONTEXT_NAME = 'En kontekst med dette navnet finnes allerede';

export interface TrainingContextListItem {
  id: number;
  name: string;
  archived: boolean;
  /** Number of completed treningsøkter in the kontekst. */
  workoutCount: number;
}

export interface TrainingContextDetail extends TrainingContextListItem {
  /** Exercise names from the latest completed treningsøkt in the kontekst, in workout order. */
  lastExercises: string[];
  /** Whether the active treningsøkt belongs to this kontekst. */
  hasActiveWorkout: boolean;
  /** Whether this is the only kontekst that is not archived. */
  isLastActive: boolean;
}

type TrainingContextRow = {
  id: number;
  name: string;
  archived_at: string | null;
  workout_count: number;
};

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
  SELECT training_contexts.id, training_contexts.name, training_contexts.archived_at,
    (SELECT COUNT(*) FROM workouts
      WHERE workouts.training_context_id = training_contexts.id
        AND workouts.status = 'completed') AS workout_count
  FROM training_contexts
`;

function toListItem(row: TrainingContextRow): TrainingContextListItem {
  return { id: row.id, name: row.name, archived: row.archived_at !== null, workoutCount: row.workout_count };
}

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

/** SQL condition that holds when another kontekst than `training_contexts.id` is not archived. */
const ANOTHER_ACTIVE_TRAINING_CONTEXT = `EXISTS (
  SELECT 1 FROM training_contexts AS other
  WHERE other.id <> training_contexts.id AND other.archived_at IS NULL
)`;

async function listTrainingContextsWithDatabase(database: Database): Promise<TrainingContextListItem[]> {
  const rows = await database.getAllAsync<TrainingContextRow>(TRAINING_CONTEXT_SELECT);
  return rows
    .map(toListItem)
    .sort((left, right) => bokmalCollator.compare(left.name, right.name) || left.id - right.id);
}

/**
 * Kontekster offered when a treningsøkt starts, with archived ones included so
 * that callers can tell how many kontekster exist in total.
 */
export interface TrainingContextChoice {
  id: number;
  name: string;
  archived: boolean;
  /** Start time of the most recent treningsøkt in the kontekst, if any. */
  lastUsedAt: string | null;
}

async function listTrainingContextChoicesWithDatabase(database: Database): Promise<TrainingContextChoice[]> {
  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    archived_at: string | null;
    last_used_at: string | null;
  }>(`
    SELECT training_contexts.id, training_contexts.name, training_contexts.archived_at,
      (SELECT MAX(workouts.started_at) FROM workouts
        WHERE workouts.training_context_id = training_contexts.id) AS last_used_at
    FROM training_contexts
    ORDER BY training_contexts.id ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    archived: row.archived_at !== null,
    lastUsedAt: row.last_used_at,
  }));
}

/**
 * Inserts a kontekst with a normalized name. Callers own the transaction.
 * Throws `DuplicateTrainingContextNameError` when the name is taken.
 */
export async function insertTrainingContext(
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
  const state = await database.getFirstAsync<{ has_active_workout: number; active_count: number }>(`
    SELECT
      EXISTS (SELECT 1 FROM workouts WHERE training_context_id = ? AND status = 'active') AS has_active_workout,
      (SELECT COUNT(*) FROM training_contexts WHERE archived_at IS NULL) AS active_count
  `, trainingContextId);
  const item = toListItem(row);
  return {
    ...item,
    lastExercises: await loadLastTrainingContextExercisesWithDatabase(database, trainingContextId),
    hasActiveWorkout: state?.has_active_workout === 1,
    isLastActive: !item.archived && state?.active_count === 1,
  };
}

async function archiveTrainingContextWithDatabase(database: Database, trainingContextId: number): Promise<void> {
  await transaction(database, async () => {
    const result = await database.runAsync(`
      UPDATE training_contexts SET archived_at = ?
      WHERE id = ? AND archived_at IS NULL AND ${ANOTHER_ACTIVE_TRAINING_CONTEXT}
    `, new Date().toISOString(), trainingContextId);
    if (result.changes === 1) return;
    const existing = await database.getFirstAsync<{ archived_at: string | null }>(
      'SELECT archived_at FROM training_contexts WHERE id = ?',
      trainingContextId,
    );
    if (!existing) throw new TrainingContextNotFoundError();
    if (existing.archived_at === null) throw new LastActiveTrainingContextError();
  });
}

async function activateTrainingContextWithDatabase(database: Database, trainingContextId: number): Promise<void> {
  const result = await database.runAsync(
    'UPDATE training_contexts SET archived_at = NULL WHERE id = ?',
    trainingContextId,
  );
  if (result.changes !== 1) throw new TrainingContextNotFoundError();
}

/**
 * Deletes a kontekst without any treningsøkter. The last active kontekst
 * cannot be deleted, so that a treningsøkt can always be started.
 */
async function deleteTrainingContextWithDatabase(database: Database, trainingContextId: number): Promise<void> {
  await transaction(database, async () => {
    const result = await database.runAsync(`
      DELETE FROM training_contexts
      WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM workouts WHERE workouts.training_context_id = training_contexts.id)
        AND (archived_at IS NOT NULL OR ${ANOTHER_ACTIVE_TRAINING_CONTEXT})
    `, trainingContextId);
    if (result.changes === 1) return;
    const existing = await database.getFirstAsync<{ has_workouts: number }>(`
      SELECT EXISTS (SELECT 1 FROM workouts WHERE training_context_id = training_contexts.id) AS has_workouts
      FROM training_contexts WHERE id = ?
    `, trainingContextId);
    if (!existing) throw new TrainingContextNotFoundError();
    if (existing.has_workouts === 1) throw new TrainingContextInUseError();
    throw new LastActiveTrainingContextError();
  });
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

export class LastActiveTrainingContextError extends Error {
  constructor() {
    super('The last active training context cannot be archived or deleted');
    this.name = 'LastActiveTrainingContextError';
  }
}

export class TrainingContextInUseError extends Error {
  constructor() {
    super('Training context has workouts');
    this.name = 'TrainingContextInUseError';
  }
}

export const archiveTrainingContext = databaseOperation(archiveTrainingContextWithDatabase);
export const activateTrainingContext = databaseOperation(activateTrainingContextWithDatabase);
export const deleteTrainingContext = databaseOperation(deleteTrainingContextWithDatabase);
export const listTrainingContexts = databaseOperation(listTrainingContextsWithDatabase);
export const createTrainingContext = databaseOperation(insertTrainingContext);
export const listTrainingContextChoices = databaseOperation(listTrainingContextChoicesWithDatabase);
export const renameTrainingContext = databaseOperation(renameTrainingContextWithDatabase);
export const loadLastTrainingContextExercises = databaseOperation(loadLastTrainingContextExercisesWithDatabase);
export const loadTrainingContextDetail = databaseOperation(loadTrainingContextDetailWithDatabase);
