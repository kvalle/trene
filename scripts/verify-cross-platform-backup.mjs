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
    rows = readRows(database, schemaVersion);
  } finally {
    database.close();
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

const tableCounts = countRows(rows);
if (schemaVersion !== manifest.schemaVersion
  || !sameCounts(tableCounts, manifest.tableCounts)) {
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
  // Schema 1 projection, so that a restore that migrated an older backup can
  // be compared with its source.
  schemaOneSemanticDigest: digest(Buffer.from(JSON.stringify(schemaOneProjection(rows)))),
};
if (expectedMetadataPath) {
  const expected = comparisonMode === '--expected-package'
    ? inspectExpectedPackage(expectedMetadataPath)
    : JSON.parse(readFileSync(expectedMetadataPath, 'utf8'));
  const migrated = metadata.schemaVersion > expected.schemaVersion;
  if ((!['--semantic-only', '--expected-package'].includes(comparisonMode)
      && metadata.packageSha256 !== expected.packageSha256)
    || (migrated
      ? !(metadata.formatVersion >= expected.formatVersion)
        || Object.entries(expected.tableCounts).some(([table, count]) => metadata.tableCounts[table] !== count)
        || metadata.schemaOneSemanticDigest !== expected.schemaOneSemanticDigest
      : metadata.formatVersion !== expected.formatVersion
        || metadata.schemaVersion !== expected.schemaVersion
        || !sameCounts(metadata.tableCounts, expected.tableCounts)
        || metadata.semanticDigest !== expected.semanticDigest)) {
    throw new Error('Cross-platform restore changed authoritative data semantics');
  }
}
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata));

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function inspectExpectedPackage(path) {
  const expectedEntries = unzipSync(readFileSync(path));
  const expectedManifest = JSON.parse(new TextDecoder().decode(expectedEntries['manifest.json']));
  const directory = mkdtempSync(join(tmpdir(), 'trene-expected-backup-'));
  const expectedDatabasePath = join(directory, 'database.sqlite');
  writeFileSync(expectedDatabasePath, expectedEntries['database.sqlite']);
  try {
    const expectedDatabase = new DatabaseSync(expectedDatabasePath, { readOnly: true });
    try {
      const expectedRows = readRows(expectedDatabase, expectedManifest.schemaVersion);
      return {
        formatVersion: expectedManifest.formatVersion,
        schemaVersion: expectedManifest.schemaVersion,
        tableCounts: expectedManifest.tableCounts,
        semanticDigest: digest(Buffer.from(JSON.stringify(expectedRows))),
        schemaOneSemanticDigest: digest(Buffer.from(JSON.stringify(schemaOneProjection(expectedRows)))),
      };
    } finally {
      expectedDatabase.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readRows(database, version) {
  const rows = {
    exercises: database.prepare('SELECT id, name, name_key, created_at FROM exercises ORDER BY id').all(),
    workouts: database.prepare(version >= 2
      ? 'SELECT id, training_context_id, status, started_at, completed_at FROM workouts ORDER BY id'
      : 'SELECT id, status, started_at, completed_at FROM workouts ORDER BY id').all(),
    memberships: database.prepare('SELECT id, workout_id, exercise_id, position FROM workout_exercises ORDER BY workout_id, position').all(),
    sets: database.prepare('SELECT id, workout_exercise_id, load_kg, repetitions, confirmed_at FROM workout_sets ORDER BY id').all(),
  };
  if (version >= 2) {
    rows.trainingContexts = database.prepare('SELECT id, name, name_key, archived_at, created_at FROM training_contexts ORDER BY id').all();
  }
  return rows;
}

function countRows(rows) {
  return {
    ...(rows.trainingContexts ? { training_contexts: rows.trainingContexts.length } : {}),
    exercises: rows.exercises.length,
    workouts: rows.workouts.length,
    workout_exercises: rows.memberships.length,
    workout_sets: rows.sets.length,
  };
}

function schemaOneProjection(rows) {
  return {
    exercises: rows.exercises,
    workouts: rows.workouts.map(({ id, status, started_at, completed_at }) => ({ id, status, started_at, completed_at })),
    memberships: rows.memberships,
    sets: rows.sets,
  };
}

function sameCounts(actual, expected) {
  const tables = Object.keys(expected ?? {});
  return Object.keys(actual ?? {}).length === tables.length
    && tables.every((table) => actual[table] === expected[table]);
}
