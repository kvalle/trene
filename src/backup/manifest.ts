import {
  BackupManifestComponent,
  BackupManifestV1,
  BackupPackageError,
} from './types';

const SHA_256 = /^[0-9a-f]{64}$/;
const NAMESPACE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const COMPONENT_KEYS = new Set(['path', 'type', 'size', 'sha256', 'optional', 'namespace']);
const MANIFEST_KEYS = new Set([
  'formatVersion',
  'schemaVersion',
  'appVersion',
  'createdAt',
  'components',
  'tableCounts',
]);
const FORMAT_1_TABLES = new Set([
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => expected.has(key));
}

function isNaturalNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.valueOf()) && timestamp.toISOString() === value;
}

function parseComponent(value: unknown): BackupManifestComponent {
  if (!isRecord(value) || !exactKeys(value, COMPONENT_KEYS)) {
    throw new BackupPackageError('malformed-manifest', 'Invalid component declaration');
  }

  if (
    typeof value.path !== 'string' ||
    typeof value.type !== 'string' ||
    !isNaturalNumber(value.size) ||
    typeof value.sha256 !== 'string' ||
    !SHA_256.test(value.sha256)
  ) {
    throw new BackupPackageError('malformed-manifest', 'Invalid component metadata');
  }

  if (value.optional === undefined && value.namespace === undefined) {
    return { path: value.path, type: value.type, size: value.size, sha256: value.sha256 };
  }

  if (
    value.optional !== true ||
    typeof value.namespace !== 'string' ||
    !NAMESPACE.test(value.namespace) ||
    !value.path.startsWith(`extensions/${value.namespace}/`)
  ) {
    throw new BackupPackageError(
      'malformed-manifest',
      'Optional components require a namespaced extension path',
    );
  }

  return {
    path: value.path,
    type: value.type,
    size: value.size,
    sha256: value.sha256,
    optional: true,
    namespace: value.namespace,
  };
}

export function readFormatVersion(value: unknown): number {
  if (!isRecord(value) || !isNaturalNumber(value.formatVersion) || value.formatVersion < 1) {
    throw new BackupPackageError('malformed-manifest', 'Invalid backup format version');
  }
  return value.formatVersion;
}

export function parseManifestV1(value: unknown): BackupManifestV1 {
  if (!isRecord(value) || !exactKeys(value, MANIFEST_KEYS) || readFormatVersion(value) !== 1) {
    throw new BackupPackageError('malformed-manifest', 'Invalid format-1 manifest');
  }
  if (
    !isNaturalNumber(value.schemaVersion) ||
    value.schemaVersion < 1 ||
    typeof value.appVersion !== 'string' ||
    value.appVersion.length === 0 ||
    !isCanonicalTimestamp(value.createdAt) ||
    !Array.isArray(value.components) ||
    !isRecord(value.tableCounts)
  ) {
    throw new BackupPackageError('malformed-manifest', 'Invalid format-1 manifest metadata');
  }

  const tableCounts: Record<string, number> = {};
  if (
    Object.keys(value.tableCounts).length !== FORMAT_1_TABLES.size ||
    !Object.keys(value.tableCounts).every((table) => FORMAT_1_TABLES.has(table))
  ) {
    throw new BackupPackageError(
      'malformed-manifest',
      'Format 1 requires counts for every authoritative table',
    );
  }
  for (const [table, count] of Object.entries(value.tableCounts)) {
    if (table.length === 0 || !isNaturalNumber(count)) {
      throw new BackupPackageError('malformed-manifest', 'Invalid authoritative table counts');
    }
    tableCounts[table] = count;
  }

  const components = value.components.map(parseComponent);
  const paths = new Set(components.map((component) => component.path));
  if (paths.size !== components.length) {
    throw new BackupPackageError('malformed-manifest', 'Duplicate component declaration');
  }
  const databases = components.filter(
    (component) =>
      component.path === 'database.sqlite' &&
      component.type === 'sqlite-database' &&
      component.optional !== true,
  );
  if (databases.length !== 1 || components.some((component) => component.optional !== true && component !== databases[0])) {
    throw new BackupPackageError('unsupported-component', 'Unsupported mandatory component');
  }

  return {
    formatVersion: 1,
    schemaVersion: value.schemaVersion,
    appVersion: value.appVersion,
    createdAt: value.createdAt,
    components,
    tableCounts,
  };
}
