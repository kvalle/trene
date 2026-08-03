import * as SQLite from 'expo-sqlite';

import { migrateDatabase } from './migrate';
import type { Database } from './types';

export const DATABASE_NAME = 'trene.db';

export async function openApplicationDatabase(): Promise<Database> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await migrateDatabase(database);
    return database;
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
}
