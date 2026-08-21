import { existsSync, readFileSync } from 'node:fs';

const releaseMode = process.argv.includes('--release');
const recordPath = new URL('../docs/specs/manual-backup-and-restore-qualification.json', import.meta.url);
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const errors = [];

required(record.recordVersion === 1, 'recordVersion must be 1');
required(record.release?.appVersion === readAppVersion(), 'appVersion must match app.json');
required(record.release?.formatVersion === readNumber('../src/backup/packageCodec.ts', /BACKUP_FORMAT_VERSION = (\d+)/u), 'formatVersion must match code');
required(record.release?.schemaVersion === readNumber('../src/database/schema.ts', /SCHEMA_VERSION = (\d+)/u), 'schemaVersion must match code');
required(record.dataSafety?.syntheticDataOnly === true, 'evidence must use synthetic data only');
required(record.dataSafety?.containsRawBackupOrDatabase === false, 'evidence must not contain raw backup or database data');

for (const name of ['creation', 'validation', 'restore', 'temporaryStorage', 'startupRecovery']) {
  required(record.performance?.measurements?.[name], `missing performance measurement ${name}`);
}
for (const name of ['backup', 'restore', 'interruption', 'fileFlow', 'accessibility', 'simultaneousRestoreRollbackFailure']) {
  required(record.androidPhysical?.scenarios?.[name], `missing Android physical scenario ${name}`);
}
required(['pending', 'physical', 'residual-risk'].includes(record.iosPhysical?.mode), 'invalid iOS evidence mode');

if (releaseMode) validateReleaseRecord();

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Backup qualification record is structurally valid${releaseMode ? ' and release-complete' : ''}.`);

function validateReleaseRecord() {
  required(record.status === 'passed', 'overall status must be passed');
  required(/^[0-9a-f]{40}$/u.test(record.release.targetCommit), 'targetCommit must be a full Git SHA');
  required(record.automated?.result === 'passed', 'automated qualification must pass');
  required(/^https:\/\/github\.com\/kvalle\/trene\/actions\/runs\/\d+$/u.test(record.automated?.workflowUrl), 'automated workflow URL is invalid');
  requireEvidenceHeader(record.automated, 'automated');

  required(record.performance?.result === 'passed', 'performance qualification must pass');
  requireEnvironment(record.performance?.environment, 'performance');
  required(isCompleteText(record.performance?.environment?.deviceClassRationale), 'slowest-device-class rationale is missing');
  for (const [name, measurement] of Object.entries(record.performance?.measurements ?? {})) {
    required(measurement.result === 'passed', `${name} measurement must pass`);
    const observations = measurement.observationsMs ?? measurement.observationsBytes;
    const limit = measurement.limitMs ?? measurement.limitBytes;
    required(Array.isArray(observations) && observations.length >= 3 && observations.every(isPositive), `${name} needs at least three positive observations`);
    required(isPositive(limit) && observations?.every((value) => value <= limit), `${name} observations must fit the measured limit`);
  }
  for (const field of ['exercises', 'workouts', 'workoutExercises', 'workoutSets', 'databaseBytes', 'packageBytes']) {
    required(isPositive(record.performance?.dataset?.[field]), `performance dataset ${field} must be positive`);
  }
  required(hasEvidence(record.performance), 'performance evidence is missing');

  required(record.androidPhysical?.result === 'passed', 'physical Android qualification must pass');
  requireEnvironment(record.androidPhysical?.environment, 'Android physical');
  required(
    record.androidPhysical?.environment?.apkSha256 === record.performance?.environment?.apkSha256,
    'performance and physical Android evidence must use the same APK',
  );
  for (const [name, scenario] of Object.entries(record.androidPhysical?.scenarios ?? {})) {
    required(scenario.result === 'passed', `Android physical ${name} must pass`);
    required(hasEvidence(scenario), `Android physical ${name} evidence is missing`);
  }
  const safeStop = record.androidPhysical?.scenarios?.simultaneousRestoreRollbackFailure;
  required(safeStop?.safeStopObserved === true, 'native safe stop must be observed');
  required(safeStop?.operationMarkerPreserved === true, 'operation marker preservation must be proven');
  required(safeStop?.rollbackSnapshotPreserved === true, 'rollback snapshot preservation must be proven');

  if (record.iosPhysical?.mode === 'physical') {
    required(record.iosPhysical.result === 'passed', 'physical iOS qualification must pass');
    requireEnvironment(record.iosPhysical.physicalEvidence, 'iOS physical');
    required(hasEvidence(record.iosPhysical.physicalEvidence), 'physical iOS evidence is missing');
  } else if (record.iosPhysical?.mode === 'residual-risk') {
    const risk = record.iosPhysical.residualRisk;
    required(record.iosPhysical.result === 'accepted', 'iOS residual risk must be accepted');
    for (const field of ['reason', 'impact', 'mitigation', 'owner', 'acceptedAt', 'followUpCondition']) {
      required(isCompleteText(risk?.[field]), `iOS residual risk ${field} is missing`);
    }
    required(Array.isArray(risk?.simulatorEvidence) && risk.simulatorEvidence.length > 0, 'iOS simulator evidence is missing');
  } else {
    required(false, 'iOS physical evidence or accepted residual risk is required');
  }
}

function requireEnvironment(environment, label) {
  for (const field of ['device', 'os', 'apkSha256', 'executedAt', 'tester']) {
    required(isCompleteText(environment?.[field]), `${label} environment ${field} is missing`);
  }
  required(/^[0-9a-f]{64}$/u.test(environment?.apkSha256), `${label} APK SHA-256 is invalid`);
}

function requireEvidenceHeader(value, label) {
  required(isCompleteText(value?.executedAt), `${label} execution date is missing`);
  required(isCompleteText(value?.tester), `${label} tester is missing`);
  required(hasEvidence(value), `${label} safe evidence is missing`);
}

function hasEvidence(value) {
  const evidence = value?.safeEvidence ?? value?.evidence;
  return Array.isArray(evidence) && evidence.length > 0 && evidence.every(isSafeEvidence);
}

function isSafeEvidence(value) {
  if (!isCompleteText(value)) return false;
  if (/^https:\/\/github\.com\/kvalle\/trene\/actions\/runs\/\d+(?:\/job\/\d+)?$/u.test(value)) return true;
  if (!/^docs\/qualification-evidence\/[A-Za-z0-9._/-]+\.(?:csv|json|log|md|png|txt)$/u.test(value)) return false;
  return existsSync(new URL(`../${value}`, import.meta.url));
}

function required(condition, message) {
  if (!condition) errors.push(message);
}

function isPositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isCompleteText(value) {
  return typeof value === 'string' && value.trim() !== '' && value !== 'pending';
}

function readAppVersion() {
  return JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo.version;
}

function readNumber(relativePath, pattern) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const match = pattern.exec(source);
  if (!match) throw new Error(`Could not read version from ${relativePath}`);
  return Number(match[1]);
}
