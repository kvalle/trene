import { exerciseNameKey } from '../domain/exerciseName';
import { DEFAULT_TRAINING_CONTEXT_NAME } from './schema';
import type { Database } from './types';

/** Creates the default kontekst "Standard" and returns its id. */
export async function insertDefaultTrainingContext(database: Database): Promise<number> {
  return (await database.runAsync(
    'INSERT INTO training_contexts (name, name_key, created_at) VALUES (?, ?, ?)',
    DEFAULT_TRAINING_CONTEXT_NAME,
    exerciseNameKey(DEFAULT_TRAINING_CONTEXT_NAME),
    new Date().toISOString(),
  )).lastInsertRowId;
}
