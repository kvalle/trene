import { insertDefaultTrainingContext } from './trainingContexts';
import type { Database } from './types';
import {
  MIGRATE_ONE_TO_TWO_CREATE_SQL,
  MIGRATE_ONE_TO_TWO_FINISH_SQL,
  SCHEMA_VERSION,
  VERSION_ONE_SQL,
} from './schema';

export { SCHEMA_VERSION } from './schema';

/** Opens the live database for use: configures it and migrates it to the current schema. */
export async function migrateDatabase(database: Database): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await migrateSchema(database);
}

/**
 * Migrates a database to the current schema with the same ordered steps for
 * startup upgrades and staged restores. Leaves foreign-key enforcement on.
 */
export async function migrateSchema(database: Database): Promise<void> {
  const currentVersion = await readUserVersion(database);

  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(`Unsupported database version: ${currentVersion}`);
  }
  if (currentVersion === SCHEMA_VERSION) {
    await database.execAsync('PRAGMA foreign_keys = ON;');
    return;
  }

  // Rebuilding a referenced table requires foreign-key enforcement to be off,
  // and the pragma has no effect inside a transaction.
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      if (currentVersion === 0) {
        await database.execAsync(VERSION_ONE_SQL);
      }
      if (currentVersion <= 1) {
        await migrateOneToTwo(database);
      }
      if ((await database.getAllAsync('PRAGMA foreign_key_check;')).length !== 0) {
        throw new Error('Migration produced foreign-key violations');
      }
      await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;');
      throw error;
    }
  } finally {
    await database.execAsync('PRAGMA legacy_alter_table = OFF;');
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function migrateOneToTwo(database: Database): Promise<void> {
  const sequence = await database.getFirstAsync<{ seq: number }>(
    "SELECT seq FROM sqlite_sequence WHERE name = 'workouts'",
  );
  await database.execAsync('PRAGMA legacy_alter_table = ON;');
  await database.execAsync(MIGRATE_ONE_TO_TWO_CREATE_SQL);
  const trainingContextId = await insertDefaultTrainingContext(database);
  await database.runAsync(`
    INSERT INTO workouts (id, training_context_id, status, started_at, completed_at)
    SELECT id, ?, status, started_at, completed_at FROM workouts_v1 ORDER BY id
  `, trainingContextId);
  await database.execAsync(MIGRATE_ONE_TO_TWO_FINISH_SQL);
  if (sequence) {
    // Keep AUTOINCREMENT from reusing ids of workouts deleted before the migration.
    await database.runAsync(
      "UPDATE sqlite_sequence SET seq = max(seq, ?) WHERE name = 'workouts'",
      sequence.seq,
    );
    await database.runAsync(
      "INSERT INTO sqlite_sequence (name, seq) SELECT 'workouts', ? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'workouts')",
      sequence.seq,
    );
  }
}

async function readUserVersion(database: Database): Promise<number> {
  return (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'))
    ?.user_version ?? 0;
}
