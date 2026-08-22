import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const options = parseArguments(process.argv.slice(2));
mkdirSync(options.output, { recursive: true });
const databasePath = join(options.output, 'database.sqlite');
const packagePath = join(options.output, 'large.trene-backup');
rmSync(databasePath, { force: true });

const database = new DatabaseSync(databasePath);
const schemaSource = readFileSync(new URL('../src/database/schema.ts', import.meta.url), 'utf8');
const schema = /VERSION_ONE_SQL = `([\s\S]*?)`/u.exec(schemaSource)?.[1];
if (!schema) throw new Error('Could not read VERSION_ONE_SQL');
database.exec(schema);
database.exec('PRAGMA user_version = 1; PRAGMA journal_mode = DELETE; BEGIN;');

const exercise = database.prepare('INSERT INTO exercises (id, name, name_key, created_at) VALUES (?, ?, ?, ?)');
for (let id = 1; id <= options.exercises; id += 1) {
  exercise.run(id, `Synthetic exercise ${id}`, `synthetic exercise ${id}`, timestamp(id));
}

const workout = database.prepare('INSERT INTO workouts (id, status, started_at, completed_at) VALUES (?, \'completed\', ?, ?)');
const membership = database.prepare('INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES (?, ?, ?, ?)');
const set = database.prepare('INSERT INTO workout_sets (id, workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES (?, ?, ?, ?, ?)');
let membershipId = 0;
let setId = 0;
for (let workoutId = 1; workoutId <= options.workouts; workoutId += 1) {
  const startedAt = timestamp(options.exercises + workoutId * 2);
  const completedAt = timestamp(options.exercises + workoutId * 2 + 1);
  workout.run(workoutId, startedAt, completedAt);
  for (let position = 0; position < options.memberships; position += 1) {
    membershipId += 1;
    const exerciseId = ((workoutId - 1) * options.memberships + position) % options.exercises + 1;
    membership.run(membershipId, workoutId, exerciseId, position);
    for (let index = 0; index < options.sets; index += 1) {
      setId += 1;
      set.run(setId, membershipId, 20 + index * 2.5, 5 + index, completedAt);
    }
  }
}
database.exec('COMMIT; VACUUM;');
database.close();

const databaseBytes = readFileSync(databasePath);
const tableCounts = {
  exercises: options.exercises,
  workouts: options.workouts,
  workout_exercises: membershipId,
  workout_sets: setId,
};
const manifest = {
  formatVersion: 1,
  schemaVersion: 1,
  appVersion: '0.1.0-performance-fixture',
  createdAt: '2026-08-20T00:00:00.000Z',
  components: [{
    path: 'database.sqlite',
    type: 'sqlite-database',
    size: databaseBytes.length,
    sha256: digest(databaseBytes),
  }],
  tableCounts,
};
const archive = zipSync({
  'manifest.json': [strToU8(`${JSON.stringify(manifest)}\n`), { level: 0 }],
  'database.sqlite': [databaseBytes, { level: 0 }],
});
mkdirSync(dirname(packagePath), { recursive: true });
writeFileSync(packagePath, archive);
writeFileSync(join(options.output, 'metadata.json'), `${JSON.stringify({
  tableCounts,
  databaseBytes: databaseBytes.length,
  packageBytes: archive.length,
  databaseSha256: digest(databaseBytes),
  packageSha256: digest(archive),
  parameters: options,
}, null, 2)}\n`);

function parseArguments(arguments_) {
  const values = { output: '', exercises: 500, workouts: 5000, memberships: 3, sets: 3 };
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index]?.replace(/^--/u, '');
    const value = arguments_[index + 1];
    if (!(key in values) || value === undefined) usage();
    values[key] = key === 'output' ? value : Number(value);
  }
  if (!values.output || !['exercises', 'workouts', 'memberships', 'sets'].every((key) => Number.isSafeInteger(values[key]) && values[key] > 0)) usage();
  if (values.memberships > values.exercises) throw new Error('memberships must not exceed exercises');
  return values;
}

function usage() {
  throw new Error('Usage: node scripts/create-backup-performance-fixture.mjs --output <directory> [--exercises N --workouts N --memberships N --sets N]');
}

function timestamp(offset) {
  return new Date(Date.UTC(2020, 0, 1) + offset * 60_000).toISOString();
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
