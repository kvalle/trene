import type { DatabaseRuntime } from './DatabaseRuntime';
import { databaseOperation, type Database } from './types';

async function hasTrainingDataWithDatabase(database: Database): Promise<boolean> {
  const row = await database.getFirstAsync<{ present: number }>(`
    SELECT EXISTS(
      SELECT 1 FROM exercises
      UNION ALL
      SELECT 1 FROM workouts
    ) AS present
  `);
  return row?.present === 1;
}

async function deleteTrainingDataWithDatabase(database: Database): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    await database.execAsync('DELETE FROM workouts; DELETE FROM exercises;');
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}

export const hasTrainingData = databaseOperation(hasTrainingDataWithDatabase);

export async function deleteAllTrainingData(runtime: DatabaseRuntime): Promise<void> {
  await runtime.runExclusive(async (maintenance) => {
    await maintenance.run(deleteTrainingDataWithDatabase);
    await maintenance.publishGeneration();
  });
}
