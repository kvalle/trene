import type { Database } from './types';
import { SCHEMA_VERSION, VERSION_ONE_SQL } from './schema';

export { SCHEMA_VERSION } from './schema';

export async function migrateDatabase(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');

  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;',
  );
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > SCHEMA_VERSION) {
    throw new Error(`Unsupported database version: ${currentVersion}`);
  }
  if (currentVersion === SCHEMA_VERSION) {
    return;
  }

  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    if (currentVersion === 0) {
      await database.execAsync(VERSION_ONE_SQL);
    }
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}
