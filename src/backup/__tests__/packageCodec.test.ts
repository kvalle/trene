import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fixtureChecksums from '../__fixtures__/format-1/checksums.json';
import {
  BACKUP_FORMAT_VERSION,
  createBackupPackage,
  DEFAULT_BACKUP_INSPECTION_LIMITS,
  inspectBackupPackage,
} from '../packageCodec';
import {
  BackupArchiveReader,
  BackupByteSink,
  BackupByteSource,
  BackupManifestV1,
  BackupPackageError,
} from '../types';

class MemoryFile implements BackupArchiveReader, BackupByteSink {
  private chunks: Uint8Array[] = [];
  private data = new Uint8Array();
  aborted = false;

  get size(): number {
    return this.data.length;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    return this.data.slice(offset, offset + length);
  }

  async write(chunk: Uint8Array): Promise<void> {
    this.chunks.push(chunk.slice());
  }

  async close(): Promise<void> {
    const size = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
    this.data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of this.chunks) {
      this.data.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
  }

  async abort(): Promise<void> {
    this.aborted = true;
    this.chunks = [];
  }

  setBytes(bytes: Uint8Array): void {
    this.data = bytes.slice();
  }

  bytes(): Uint8Array {
    return this.data.slice();
  }
}

function source(bytes: Uint8Array, chunkSize = 3): BackupByteSource {
  return {
    size: bytes.length,
    async *open() {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        yield bytes.slice(offset, offset + chunkSize);
      }
    },
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestFor(
  database: Uint8Array,
  overrides: Partial<BackupManifestV1> = {},
): BackupManifestV1 {
  return {
    formatVersion: 1,
    schemaVersion: 1,
    appVersion: '0.1.0',
    createdAt: '2026-08-14T12:00:00.000Z',
    components: [
      {
        path: 'database.sqlite',
        type: 'sqlite-database',
        size: database.length,
        sha256: sha256(database),
      },
    ],
    tableCounts: {
      exercises: 1,
      workouts: 1,
      workout_exercises: 1,
      workout_sets: 1,
    },
    ...overrides,
  };
}

function archive(entries: Record<string, Uint8Array>, level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 0): MemoryFile {
  const file = new MemoryFile();
  file.setBytes(zipSync(entries, { level }));
  return file;
}

function packageArchive(manifest: object, entries: Record<string, Uint8Array>): MemoryFile {
  return archive({
    'manifest.json': strToU8(`${JSON.stringify(manifest)}\n`),
    ...entries,
  });
}

function sinks(): {
  files: Map<string, MemoryFile>;
  createComponentSink(path: string): Promise<MemoryFile>;
} {
  const files = new Map<string, MemoryFile>();
  return {
    files,
    async createComponentSink(path) {
      const file = new MemoryFile();
      files.set(path, file);
      return file;
    },
  };
}

async function expectPackageError(
  operation: Promise<unknown>,
  code: BackupPackageError['code'],
): Promise<void> {
  try {
    await operation;
    throw new Error('Expected package inspection to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(BackupPackageError);
    expect((error as BackupPackageError).code).toBe(code);
  }
}

function mutateFirstCentralEntry(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const result = bytes.slice();
  for (let index = 0; index <= result.length - 4; index += 1) {
    if (result[index] === 0x50 && result[index + 1] === 0x4b && result[index + 2] === 0x01 && result[index + 3] === 0x02) {
      result[index + offset] = value;
      return result;
    }
  }
  throw new Error('Central directory not found');
}

describe('backup package codec', () => {
  const database = Uint8Array.of(0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0, 1, 2, 3);

  it('creates and streams a deterministic format-1 package', async () => {
    const output = new MemoryFile();
    const manifest = await createBackupPackage(
      {
        schemaVersion: 1,
        appVersion: '0.1.0',
        createdAt: '2026-08-14T12:00:00.000Z',
        tableCounts: manifestFor(database).tableCounts,
        database: source(database, 2),
      },
      output,
    );

    expect(BACKUP_FORMAT_VERSION).toBe(1);
    expect(manifest).toEqual(manifestFor(database));
    const extracted = sinks();
    await expect(inspectBackupPackage(output, extracted)).resolves.toEqual({
      status: 'valid',
      manifest,
      extractedPaths: ['database.sqlite'],
      ignoredOptionalPaths: [],
    });
    expect(extracted.files.get('database.sqlite')?.bytes()).toEqual(database);
  });

  it('validates understood optional components and safely ignores unknown namespaces', async () => {
    const optional = strToU8('diagnostic metadata');
    const output = new MemoryFile();
    const manifest = await createBackupPackage(
      {
        schemaVersion: 1,
        appVersion: '0.1.0',
        createdAt: '2026-08-14T12:00:00.000Z',
        tableCounts: manifestFor(database).tableCounts,
        database: source(database),
        optionalComponents: [
          {
            path: 'extensions/no.trene.notes/notes.json',
            type: 'no.trene.notes',
            namespace: 'no.trene.notes',
            optional: true,
            source: source(optional),
          },
        ],
      },
      output,
    );

    const ignored = sinks();
    await expect(inspectBackupPackage(output, ignored)).resolves.toMatchObject({
      status: 'valid',
      ignoredOptionalPaths: ['extensions/no.trene.notes/notes.json'],
    });
    expect(ignored.files.has('extensions/no.trene.notes/notes.json')).toBe(false);

    const understood = sinks();
    await expect(
      inspectBackupPackage(output, {
        ...understood,
        understoodOptionalNamespaces: new Set(['no.trene.notes']),
      }),
    ).resolves.toMatchObject({ status: 'valid', extractedPaths: manifest.components.map(({ path }) => path) });
    expect(understood.files.get('extensions/no.trene.notes/notes.json')?.bytes()).toEqual(optional);
  });

  it('returns update-required without best-effort format parsing', async () => {
    const file = packageArchive({ formatVersion: 2 }, { 'anything.bin': Uint8Array.of(1) });
    await expect(inspectBackupPackage(file, sinks())).resolves.toEqual({
      status: 'update-required',
      formatVersion: 2,
    });
  });

  it.each([
    ['invalid JSON', archive({ 'manifest.json': strToU8('{'), 'database.sqlite': database }), 'malformed-manifest'],
    ['missing manifest', archive({ 'database.sqlite': database }), 'malformed-archive'],
    ['missing database', packageArchive(manifestFor(database), {}), 'malformed-archive'],
    [
      'undeclared entry',
      packageArchive(manifestFor(database), { 'database.sqlite': database, 'extra.txt': Uint8Array.of(1) }),
      'unsafe-archive',
    ],
    [
      'unknown mandatory component',
      packageArchive(
        manifestFor(database, {
          components: [
            manifestFor(database).components[0]!,
            { path: 'media.bin', type: 'media', size: 1, sha256: sha256(Uint8Array.of(1)) },
          ],
        }),
        { 'database.sqlite': database, 'media.bin': Uint8Array.of(1) },
      ),
      'unsupported-component',
    ],
    [
      'digest mismatch',
      packageArchive(manifestFor(database), {
        'database.sqlite': Uint8Array.from(database, (byte, index) => (index === 0 ? byte ^ 1 : byte)),
      }),
      'integrity-mismatch',
    ],
    [
      'size mismatch',
      packageArchive(
        manifestFor(database, {
          components: [{ ...manifestFor(database).components[0]!, size: database.length + 1 }],
        }),
        { 'database.sqlite': database },
      ),
      'integrity-mismatch',
    ],
  ] as const)('rejects %s', async (_name, file, code) => {
    await expectPackageError(inspectBackupPackage(file, sinks()), code);
  });

  it.each(['../database.sqlite', '/database.sqlite', 'C:/database.sqlite', 'folder\\database.sqlite'])(
    'rejects unsafe path %s',
    async (path) => {
      await expectPackageError(inspectBackupPackage(archive({ [path]: database }), sinks()), 'unsafe-archive');
    },
  );

  it('rejects duplicate entries', async () => {
    const file = archive({ aaaa: Uint8Array.of(1), bbbb: Uint8Array.of(2) });
    const bytes = file.bytes();
    const centralSignature = Uint8Array.of(0x50, 0x4b, 0x01, 0x02);
    const first = bytes.findIndex((value, index) => centralSignature.every((byte, part) => bytes[index + part] === byte));
    const second = bytes.findIndex(
      (value, index) => index > first && centralSignature.every((byte, part) => bytes[index + part] === byte),
    );
    const result = bytes.slice();
    result.set(strToU8('aaaa'), second + 46);
    const reader: BackupArchiveReader = {
      size: result.length,
      async read(offset, length) {
        return result.slice(offset, offset + length);
      },
    };
    await expectPackageError(inspectBackupPackage(reader, sinks()), 'unsafe-archive');
  });

  it.each([
    ['encrypted', 8, 1],
    ['symlink', 5, 3],
  ] as const)('rejects %s entries', async (_name, offset, value) => {
    const file = archive({ 'manifest.json': strToU8('{}') });
    const mutated = mutateFirstCentralEntry(file.bytes(), offset, value);
    if (offset === 5) {
      const central = mutated.findIndex(
        (byte, index) => byte === 0x50 && mutated[index + 1] === 0x4b && mutated[index + 2] === 0x01,
      );
      const mode = 0o120777;
      mutated[central + 40] = mode & 255;
      mutated[central + 41] = (mode >>> 8) & 255;
    }
    const reader = new MemoryFile();
    reader.setBytes(mutated);
    await expectPackageError(inspectBackupPackage(reader, sinks()), 'unsafe-archive');
  });

  it('enforces entry, manifest, path, byte, and expansion limits before extraction', async () => {
    const valid = packageArchive(manifestFor(database), { 'database.sqlite': database });
    for (const limits of [
      { maxEntries: 1 },
      { maxManifestBytes: 1 },
      { maxPathBytes: 5 },
      { maxCompressedBytes: 1 },
      { maxUncompressedBytes: 1 },
    ]) {
      await expectPackageError(inspectBackupPackage(valid, { ...sinks(), limits }), 'resource-limit');
    }

    const compressedDatabase = new Uint8Array(10_000);
    const compressed = archive(
      {
        'manifest.json': strToU8(`${JSON.stringify(manifestFor(compressedDatabase))}\n`),
        'database.sqlite': compressedDatabase,
      },
      9,
    );
    await expectPackageError(
      inspectBackupPackage(compressed, { ...sinks(), limits: { maxExpansionRatio: 2 } }),
      'resource-limit',
    );

    await expectPackageError(
      inspectBackupPackage(archive({ 'too/deep/path': Uint8Array.of(1) }), {
        ...sinks(),
        limits: { maxPathDepth: 2 },
      }),
      'resource-limit',
    );
  });

  it('aborts output if a component changes between metadata and writing', async () => {
    let opening = 0;
    const changing: BackupByteSource = {
      size: database.length,
      async *open() {
        opening += 1;
        yield opening === 1 ? database : new Uint8Array(database.length);
      },
    };
    const output = new MemoryFile();
    await expectPackageError(
      createBackupPackage(
        {
          schemaVersion: 1,
          appVersion: '0.1.0',
          createdAt: '2026-08-14T12:00:00.000Z',
          tableCounts: manifestFor(database).tableCounts,
          database: changing,
        },
        output,
      ),
      'integrity-mismatch',
    );
    expect(output.aborted).toBe(true);
  });

  it('aborts an extracted component before exposing a SHA-256 mismatch', async () => {
    const corrupt = Uint8Array.from(database, (byte, index) => (index === 0 ? byte ^ 1 : byte));
    const file = packageArchive(manifestFor(database), { 'database.sqlite': corrupt });
    const output = new MemoryFile();
    await expectPackageError(
      inspectBackupPackage(file, { async createComponentSink() { return output; } }),
      'integrity-mismatch',
    );
    expect(output.aborted).toBe(true);
    expect(output.size).toBe(0);
  });

  it('rejects incomplete format-1 table counts', async () => {
    const file = packageArchive(manifestFor(database, { tableCounts: { exercises: 1 } }), {
      'database.sqlite': database,
    });
    await expectPackageError(inspectBackupPackage(file, sinks()), 'malformed-manifest');
  });

  it('rejects unknown format-1 table counts', async () => {
    const file = packageArchive(
      manifestFor(database, {
        tableCounts: { ...manifestFor(database).tableCounts, future_table: 1 },
      }),
      { 'database.sqlite': database },
    );
    await expectPackageError(inspectBackupPackage(file, sinks()), 'malformed-manifest');
  });

  it('rejects invalid UTF-8 manifest content', async () => {
    const file = archive({
      'manifest.json': Uint8Array.of(0x7b, 0xff, 0x7d),
      'database.sqlite': database,
    });
    await expectPackageError(inspectBackupPackage(file, sinks()), 'malformed-manifest');
  });

  it('bounds central-directory metadata before reading it', async () => {
    const file = packageArchive(manifestFor(database), { 'database.sqlite': database });
    await expectPackageError(
      inspectBackupPackage(file, { ...sinks(), limits: { maxArchiveMetadataBytes: 1 } }),
      'resource-limit',
    );
  });

  it('has adjustable defaults without a practical total-size ceiling', () => {
    expect(DEFAULT_BACKUP_INSPECTION_LIMITS.maxCompressedBytes).toBe(Number.MAX_SAFE_INTEGER);
    expect(DEFAULT_BACKUP_INSPECTION_LIMITS.maxUncompressedBytes).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    ['representative.trene-backup.base64', 2, 1],
    ['rich-edge-case.trene-backup.base64', 100, 42],
  ] as const)('preserves immutable format-1 fixture %s', async (name, exercises, workouts) => {
    const encoded = readFileSync(join(__dirname, '..', '__fixtures__', 'format-1', name), 'utf8').trim();
    const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'));
    expect(sha256(bytes)).toBe(fixtureChecksums[name]);
    const fixture = new MemoryFile();
    fixture.setBytes(bytes);
    const result = await inspectBackupPackage(fixture, sinks());
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.manifest.tableCounts).toMatchObject({ exercises, workouts });
    }
  });
});
