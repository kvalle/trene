import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import {
  createTrainingContext,
  DuplicateTrainingContextNameError,
  listTrainingContexts,
  loadLastTrainingContextExercises,
  loadTrainingContextDetail,
  renameTrainingContext,
  TrainingContextNotFoundError,
} from '../trainingContexts';

class TestDatabase implements Database {
  constructor(private readonly database = new DatabaseSync(':memory:')) {}
  async execAsync(source: string) { this.database.exec(source); }
  async getFirstAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null;
  }
  async getAllAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T[]> {
    return this.database.prepare(source).all(...params) as T[];
  }
  async runAsync(source: string, ...params: DatabaseValue[]) {
    const result = this.database.prepare(source).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async closeAsync() { this.database.close(); }
}

async function setup() {
  const database = new TestDatabase();
  await migrateDatabase(database);
  return database;
}

async function exercise(database: Database, name: string) {
  return (await database.runAsync(
    'INSERT INTO exercises (name, name_key, created_at) VALUES (?, ?, ?)',
    name, exerciseNameKey(name), 'created',
  )).lastInsertRowId;
}

async function workout(
  database: Database,
  trainingContextId: number,
  status: 'active' | 'completed',
  completedAt: string | null,
  exerciseIds: number[],
) {
  const workoutId = (await database.runAsync(
    'INSERT INTO workouts (training_context_id, status, started_at, completed_at) VALUES (?, ?, ?, ?)',
    trainingContextId, status, 'started', completedAt,
  )).lastInsertRowId;
  for (const [position, exerciseId] of exerciseIds.entries()) {
    await database.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
      workoutId, exerciseId, position,
    );
  }
  return workoutId;
}

const create = (database: Database, name: string) => createTrainingContext(database, name, exerciseNameKey(name));

describe('training context persistence', () => {
  test('lists kontekster in Bokmål order with their completed treningsøkt count', async () => {
    const database = await setup();
    const gym = await create(database, 'Treningssenter');
    const hytta = await create(database, 'Åsen');
    await workout(database, 1, 'completed', '2026-11-01T10:00:00Z', []);
    await workout(database, 1, 'completed', '2026-11-02T10:00:00Z', []);
    await workout(database, gym, 'completed', '2026-11-03T10:00:00Z', []);
    await workout(database, gym, 'active', null, []);

    expect(await listTrainingContexts(database)).toEqual([
      { id: 1, name: 'Standard', workoutCount: 2 },
      { id: gym, name: 'Treningssenter', workoutCount: 1 },
      { id: hytta, name: 'Åsen', workoutCount: 0 },
    ]);
  });

  test('creates kontekster with case-insensitive unique names', async () => {
    const database = await setup();
    await create(database, 'Fysio');

    await expect(create(database, 'FYSIO')).rejects.toBeInstanceOf(DuplicateTrainingContextNameError);
    await expect(create(database, 'standard')).rejects.toBeInstanceOf(DuplicateTrainingContextNameError);
    await expect(createTrainingContext(database, ' Fysio ', 'fysio')).rejects.toThrow(/normalized/);
    expect((await listTrainingContexts(database)).map((context) => context.name)).toEqual(['Fysio', 'Standard']);
  });

  test('renames a kontekst, allows changing case of its own name and rejects duplicates', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');

    await renameTrainingContext(database, 1, 'STANDARD', exerciseNameKey('STANDARD'));
    await renameTrainingContext(database, 1, 'Hjemme', exerciseNameKey('Hjemme'));
    await expect(renameTrainingContext(database, fysio, 'hjemme', 'hjemme'))
      .rejects.toBeInstanceOf(DuplicateTrainingContextNameError);
    await expect(renameTrainingContext(database, 99, 'Ny', 'ny'))
      .rejects.toBeInstanceOf(TrainingContextNotFoundError);
    expect((await listTrainingContexts(database)).map((context) => context.name)).toEqual(['Fysio', 'Hjemme']);
  });

  test('loads exercises from the latest completed treningsøkt in the kontekst only', async () => {
    const database = await setup();
    const gym = await create(database, 'Treningssenter');
    const [knebøy, benk, roing, press] = [
      await exercise(database, 'Knebøy'),
      await exercise(database, 'Benkpress'),
      await exercise(database, 'Roing'),
      await exercise(database, 'Skulderpress'),
    ];
    await workout(database, 1, 'completed', '2026-11-01T10:00:00Z', [knebøy]);
    await workout(database, 1, 'completed', '2026-11-05T10:00:00Z', [roing, benk]);
    await workout(database, 1, 'active', null, [press]);
    await workout(database, gym, 'completed', '2026-11-09T10:00:00Z', [press]);

    expect(await loadLastTrainingContextExercises(database, 1)).toEqual(['Roing', 'Benkpress']);
    expect(await loadTrainingContextDetail(database, 1)).toEqual({
      id: 1, name: 'Standard', workoutCount: 2, lastExercises: ['Roing', 'Benkpress'],
    });
  });

  test('returns an empty exercise list for an unused kontekst and null for a missing one', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');

    expect(await loadTrainingContextDetail(database, fysio)).toEqual({
      id: fysio, name: 'Fysio', workoutCount: 0, lastExercises: [],
    });
    expect(await loadTrainingContextDetail(database, 99)).toBeNull();
  });
});
