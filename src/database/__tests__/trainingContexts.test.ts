import { DatabaseSync } from 'node:sqlite';

import { exerciseNameKey } from '../../domain/exerciseName';
import { migrateDatabase } from '../migrate';
import type { Database, DatabaseValue } from '../types';
import { completeWorkout } from '../workouts';
import {
  activateTrainingContext,
  archiveTrainingContext,
  createTrainingContext,
  deleteTrainingContext,
  LastActiveTrainingContextError,
  TrainingContextInUseError,
  DuplicateTrainingContextNameError,
  listTrainingContextChoices,
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
      { id: 1, name: 'Standard', archived: false, workoutCount: 2 },
      { id: gym, name: 'Treningssenter', archived: false, workoutCount: 1 },
      { id: hytta, name: 'Åsen', archived: false, workoutCount: 0 },
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
      id: 1,
      name: 'Standard',
      archived: false,
      workoutCount: 2,
      lastExercises: ['Roing', 'Benkpress'],
      hasActiveWorkout: true,
      isLastActive: false,
    });
  });

  test('returns an empty exercise list for an unused kontekst and null for a missing one', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');

    expect(await loadTrainingContextDetail(database, fysio)).toEqual({
      id: fysio,
      name: 'Fysio',
      archived: false,
      workoutCount: 0,
      lastExercises: [],
      hasActiveWorkout: false,
      isLastActive: false,
    });
    expect(await loadTrainingContextDetail(database, 99)).toBeNull();
  });

  test('lists start choices with archived state and the start time of the latest treningsøkt', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');
    const archived = await create(database, 'Gammel');
    await database.runAsync("UPDATE training_contexts SET archived_at = 'then' WHERE id = ?", archived);
    for (const startedAt of ['2026-01-01T10:00:00Z', '2026-03-01T10:00:00Z']) {
      await database.runAsync(
        "INSERT INTO workouts (training_context_id, status, started_at, completed_at) VALUES (1, 'completed', ?, ?)",
        startedAt, startedAt,
      );
    }
    await database.runAsync(
      "INSERT INTO workouts (training_context_id, status, started_at) VALUES (?, 'active', '2026-02-01T10:00:00Z')",
      fysio,
    );

    expect(await listTrainingContextChoices(database)).toEqual([
      { id: 1, name: 'Standard', archived: false, lastUsedAt: '2026-03-01T10:00:00Z' },
      { id: fysio, name: 'Fysio', archived: false, lastUsedAt: '2026-02-01T10:00:00Z' },
      { id: archived, name: 'Gammel', archived: true, lastUsedAt: null },
    ]);
  });

  test('archives and activates kontekster, but never the last active one', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');

    await archiveTrainingContext(database, fysio);
    expect(await loadTrainingContextDetail(database, fysio)).toMatchObject({ archived: true, isLastActive: false });
    expect(await loadTrainingContextDetail(database, 1)).toMatchObject({ archived: false, isLastActive: true });
    expect((await listTrainingContextChoices(database)).filter((choice) => !choice.archived).map((choice) => choice.id))
      .toEqual([1]);

    await expect(archiveTrainingContext(database, 1)).rejects.toBeInstanceOf(LastActiveTrainingContextError);
    await expect(archiveTrainingContext(database, 99)).rejects.toBeInstanceOf(TrainingContextNotFoundError);
    await archiveTrainingContext(database, fysio);

    await activateTrainingContext(database, fysio);
    expect(await loadTrainingContextDetail(database, 1)).toMatchObject({ isLastActive: false });
    await archiveTrainingContext(database, 1);
    expect((await listTrainingContexts(database)).map(({ name, archived }) => ({ name, archived }))).toEqual([
      { name: 'Fysio', archived: false },
      { name: 'Standard', archived: true },
    ]);
    await expect(activateTrainingContext(database, 99)).rejects.toBeInstanceOf(TrainingContextNotFoundError);
  });

  test('lets an active treningsøkt in an archived kontekst be completed', async () => {
    const database = await setup();
    const fysio = await create(database, 'Fysio');
    const knebøy = await exercise(database, 'Knebøy');
    const workoutId = await workout(database, fysio, 'active', null, [knebøy]);
    await database.runAsync(
      "INSERT INTO workout_sets (workout_exercise_id, load_kg, repetitions, confirmed_at) SELECT id, 50, 5, 'now' FROM workout_exercises",
    );

    await archiveTrainingContext(database, fysio);
    await completeWorkout(database, workoutId, '2026-11-10T10:00:00Z');

    expect(await loadTrainingContextDetail(database, fysio)).toMatchObject({
      archived: true, workoutCount: 1, hasActiveWorkout: false,
    });
  });

  test('deletes only kontekster without treningsøkter and keeps an active kontekst', async () => {
    const database = await setup();
    const used = await create(database, 'Brukt');
    const inProgress = await create(database, 'Pågår');
    const unused = await create(database, 'Ubrukt');
    await workout(database, used, 'completed', '2026-11-01T10:00:00Z', []);
    await workout(database, inProgress, 'active', null, []);

    await expect(deleteTrainingContext(database, used)).rejects.toBeInstanceOf(TrainingContextInUseError);
    await expect(deleteTrainingContext(database, inProgress)).rejects.toBeInstanceOf(TrainingContextInUseError);
    await deleteTrainingContext(database, unused);
    await expect(deleteTrainingContext(database, unused)).rejects.toBeInstanceOf(TrainingContextNotFoundError);
    expect((await listTrainingContexts(database)).map((context) => context.name)).toEqual(['Brukt', 'Pågår', 'Standard']);

    await archiveTrainingContext(database, used);
    await archiveTrainingContext(database, inProgress);
    await expect(deleteTrainingContext(database, 1)).rejects.toBeInstanceOf(LastActiveTrainingContextError);
    const archivedUnused = await create(database, 'Arkivert');
    await archiveTrainingContext(database, archivedUnused);
    await deleteTrainingContext(database, archivedUnused);
    expect((await listTrainingContexts(database)).map((context) => context.name)).toEqual(['Brukt', 'Pågår', 'Standard']);
  });
});
