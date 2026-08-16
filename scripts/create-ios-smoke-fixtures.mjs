import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/create-ios-smoke-fixtures.mjs <directory>');
mkdirSync(output, { recursive: true });

const databasePath = join(output, 'database.sqlite');
rmSync(databasePath, { force: true });
const database = new DatabaseSync(databasePath);
const schemaSource = readFileSync(new URL('../src/database/schema.ts', import.meta.url), 'utf8');
const schema = /VERSION_ONE_SQL = `([\s\S]*?)`/u.exec(schemaSource)?.[1];
if (!schema) throw new Error('Could not read VERSION_ONE_SQL');
database.exec(schema);
database.exec(`
  PRAGMA user_version = 1;
  INSERT INTO exercises (id, name, name_key, created_at) VALUES
    (1, 'Knebøy', 'knebøy', '2026-08-14T09:00:00.000Z'),
    (2, 'Markløft', 'markløft', '2026-08-14T09:01:00.000Z');
  INSERT INTO workouts (id, status, started_at, completed_at)
    VALUES (1, 'completed', '2026-08-14T10:00:00.000Z', '2026-08-14T10:30:00.000Z');
  INSERT INTO workout_exercises (id, workout_id, exercise_id, position) VALUES
    (1, 1, 1, 0), (2, 1, 2, 1);
  INSERT INTO workout_sets (id, workout_exercise_id, load_kg, repetitions, confirmed_at) VALUES
    (1, 1, 80, 5, '2026-08-14T10:10:00.000Z'),
    (2, 2, 100, 3, '2026-08-14T10:20:00.000Z');
`);
database.close();

const databaseBytes = readFileSync(databasePath);
const manifest = {
  formatVersion: 1,
  schemaVersion: 1,
  appVersion: '0.1.0-ios-smoke',
  createdAt: '2026-08-14T12:00:00.000Z',
  components: [{
    path: 'database.sqlite',
    type: 'sqlite-database',
    size: databaseBytes.length,
    sha256: digest(databaseBytes),
  }],
  tableCounts: { exercises: 2, workouts: 1, workout_exercises: 2, workout_sets: 2 },
};
writePackage('representative.trene-backup', manifest, databaseBytes);
writePackage('newer.trene-backup', { ...manifest, formatVersion: 2 }, databaseBytes);
writePackage('damaged.trene-backup', manifest, new Uint8Array(databaseBytes.length));
writeFileSync(join(output, 'checksums.txt'), [
  'representative.trene-backup', 'newer.trene-backup', 'damaged.trene-backup',
].map((name) => `${digest(readFileSync(join(output, name)))}  ${name}`).join('\n') + '\n');

function writePackage(name, packageManifest, bytes) {
  const archive = zipSync({
    'manifest.json': [strToU8(`${JSON.stringify(packageManifest)}\n`), { level: 0 }],
    'database.sqlite': [bytes, { level: 0 }],
  });
  const path = join(output, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, archive);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
