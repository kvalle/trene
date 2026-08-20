import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { unzipSync } from 'fflate';

const [packagePath, metadataPath, expectedMetadataPath, comparisonMode] = process.argv.slice(2);
if (!packagePath || !metadataPath) {
  throw new Error('Usage: node scripts/verify-cross-platform-backup.mjs <package> <metadata> [expected-metadata]');
}

const packageBytes = readFileSync(packagePath);
const entries = unzipSync(packageBytes);
if (Object.keys(entries).sort().join(',') !== 'database.sqlite,manifest.json') {
  throw new Error('Backup must contain exactly manifest.json and database.sqlite');
}
const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
const databaseBytes = entries['database.sqlite'];
const component = manifest.components?.find((entry) => entry.path === 'database.sqlite');
if (!component || component.size !== databaseBytes.length || component.sha256 !== digest(databaseBytes)) {
  throw new Error('Database component digest or size does not match the manifest');
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'trene-backup-'));
const databasePath = join(temporaryDirectory, 'database.sqlite');
writeFileSync(databasePath, databaseBytes);
let schemaVersion;
let rows;
try {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const integrity = database.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
    if (database.prepare('PRAGMA foreign_key_check').all().length !== 0) throw new Error('SQLite foreign-key check failed');
    schemaVersion = database.prepare('PRAGMA user_version').get().user_version;
    rows = {
      exercises: database.prepare('SELECT id, name, name_key, created_at FROM exercises ORDER BY id').all(),
      workouts: database.prepare('SELECT id, status, started_at, completed_at FROM workouts ORDER BY id').all(),
      memberships: database.prepare('SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY workout_id, position').all(),
      sets: database.prepare('SELECT id, workout_exercise_id, load_kg, repetitions, confirmed_at FROM workout_sets ORDER BY id').all(),
    };
  } finally {
    database.close();
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

const tableCounts = {
  exercises: rows.exercises.length,
  workouts: rows.workouts.length,
  workout_exercises: rows.memberships.length,
  workout_sets: rows.sets.length,
};
if (schemaVersion !== manifest.schemaVersion
  || JSON.stringify(tableCounts) !== JSON.stringify(manifest.tableCounts)) {
  throw new Error('Database schema or authoritative table counts do not match the manifest');
}
const metadata = {
  packageSha256: digest(packageBytes),
  appVersion: manifest.appVersion,
  formatVersion: manifest.formatVersion,
  schemaVersion,
  platform: process.env.QUALIFICATION_PLATFORM ?? 'host',
  scenario: process.env.QUALIFICATION_SCENARIO ?? 'package-verification',
  stage: process.env.QUALIFICATION_STAGE ?? 'verified-runtime-export',
  tableCounts,
  semanticDigest: digest(Buffer.from(JSON.stringify(rows))),
};
if (expectedMetadataPath) {
  const expected = JSON.parse(readFileSync(expectedMetadataPath, 'utf8'));
  if ((comparisonMode !== '--semantic-only' && metadata.packageSha256 !== expected.packageSha256)
    || metadata.formatVersion !== expected.formatVersion
    || metadata.schemaVersion !== expected.schemaVersion
    || JSON.stringify(metadata.tableCounts) !== JSON.stringify(expected.tableCounts)
    || metadata.semanticDigest !== expected.semanticDigest) {
    throw new Error('Cross-platform restore changed authoritative data semantics');
  }
}
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata));

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
