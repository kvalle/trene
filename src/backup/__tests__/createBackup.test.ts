import { createAndShareBackup, type BackupArtifact, type BackupPlatform } from '../createBackup';
import { DatabaseRuntime } from '../../database/DatabaseRuntime';
import type { Database } from '../../database/types';
import type { BackupByteSink } from '../types';

const snapshotBytes = Uint8Array.of(83, 81, 76, 105, 116, 101);
const inspection = {
  schemaVersion: 1,
  tableCounts: { exercises: 2, workouts: 1, workout_exercises: 2, workout_sets: 3 },
  previewCounts: { exercises: 2, workouts: 1 },
  semanticDigest: '1'.repeat(64),
};

test('validates the snapshot and completed package before sharing', async () => {
  const events: string[] = [];
  const database = fakeDatabase();
  const runtime = new DatabaseRuntime(async () => database);
  await runtime.start();
  const platform = fakePlatform(events);

  const manifest = await createAndShareBackup(runtime, platform, {
    appVersion: '1.2.3',
    now: () => new Date('2026-08-14T12:00:00.000Z'),
  });

  expect(manifest).toMatchObject({ appVersion: '1.2.3', createdAt: '2026-08-14T12:00:00.000Z', tableCounts: inspection.tableCounts });
  expect(events).toEqual([
    'serialize',
    'inspect:trene-export-2026-08-14T12-00-00.000Z.sqlite',
    'inspect:trene-check-2026-08-14T12-00-00.000Z.sqlite',
    'share:trene-backup-2026-08-14T12-00-00.000Z.trene-backup',
    'remove:trene-export-2026-08-14T12-00-00.000Z.sqlite',
    'remove:trene-backup-2026-08-14T12-00-00.000Z.trene-backup',
    'remove:trene-check-2026-08-14T12-00-00.000Z.sqlite',
  ]);
});

test('removes artifacts already created when later temporary allocation fails', async () => {
  const events: string[] = [];
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();
  const platform = fakePlatform(events);
  let creations = 0;
  platform.createArtifact = (name) => {
    creations += 1;
    if (creations === 2) throw new Error('storage full');
    return new MemoryArtifact(name, events);
  };

  await expect(createAndShareBackup(runtime, platform, { appVersion: '1' })).rejects.toThrow('storage full');
  expect(events.filter((event) => event.startsWith('remove:'))).toHaveLength(1);
});

test('never shares invalid output and removes every temporary artifact', async () => {
  const events: string[] = [];
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();
  const platform = fakePlatform(events);
  platform.inspectSnapshot = jest.fn(async (source) => {
    events.push(`inspect:${(source as BackupArtifact).uri}`);
    if ((source as BackupArtifact).uri.includes('trene-check')) throw new Error('invalid snapshot');
    return inspection;
  });

  await expect(createAndShareBackup(runtime, platform, { appVersion: '1' })).rejects.toThrow('invalid snapshot');

  expect(events).not.toContainEqual(expect.stringMatching(/^share:/));
  expect(events.filter((event) => event.startsWith('remove:'))).toHaveLength(3);
});

test.each([
  'backup.stage-artifacts',
  'backup.snapshot',
  'backup.snapshot-validation',
  'backup.package',
  'backup.package-validation',
  'backup.share',
] as const)('does not offer an export interrupted before %s completes', async (stage) => {
  const events: string[] = [];
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();
  const platform = fakePlatform(events);

  await expect(createAndShareBackup(runtime, platform, {
    appVersion: '1',
    checkpoint: async (current, timing) => {
      if (current === stage && timing === 'before') throw new Error(`injected:${stage}`);
    },
  })).rejects.toThrow(`injected:${stage}`);

  expect(events).not.toContainEqual(expect.stringMatching(/^share:/));
  expect(events.filter((event) => event.startsWith('remove:'))).toHaveLength(
    stage === 'backup.stage-artifacts' ? 0 : 3,
  );
});

test('exposes every completed export stage to the fault matrix', async () => {
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();
  const visited = new Set<string>();

  await createAndShareBackup(runtime, fakePlatform([]), {
    appVersion: '1',
    checkpoint: async (stage, timing) => { visited.add(`${stage}:${timing}`); },
  });

  expect([...visited]).toEqual(expect.arrayContaining([
    'backup.stage-artifacts:before', 'backup.stage-artifacts:after',
    'backup.snapshot:before', 'backup.snapshot:after',
    'backup.snapshot-validation:before', 'backup.snapshot-validation:after',
    'backup.package:before', 'backup.package:after',
    'backup.package-validation:before', 'backup.package-validation:after',
    'backup.share:before', 'backup.share:after',
    'backup.cleanup:before', 'backup.cleanup:after',
  ]));
});

test('cleans every artifact even when interruption is injected before cleanup', async () => {
  const events: string[] = [];
  const runtime = new DatabaseRuntime(async () => fakeDatabase());
  await runtime.start();

  await expect(createAndShareBackup(runtime, fakePlatform(events), {
    appVersion: '1',
    checkpoint: async (stage, timing) => {
      if (stage === 'backup.cleanup' && timing === 'before') throw new Error('interrupted cleanup');
    },
  })).rejects.toThrow('interrupted cleanup');

  expect(events.filter((event) => event.startsWith('remove:'))).toHaveLength(3);
});

function fakePlatform(events: string[]): BackupPlatform {
  return {
    createArtifact: (name) => new MemoryArtifact(name, events),
    serializeSnapshot: async () => { events.push('serialize'); return snapshotBytes; },
    inspectSnapshot: async (source) => { events.push(`inspect:${(source as BackupArtifact).uri}`); return inspection; },
    share: async (uri) => { events.push(`share:${uri}`); },
  };
}

class MemoryArtifact implements BackupArtifact {
  bytes = new Uint8Array();
  constructor(readonly uri: string, private readonly events: string[]) {}
  get size() { return this.bytes.length; }
  async read(offset: number, length: number) { return this.bytes.slice(offset, offset + length); }
  async *open() { yield this.bytes; }
  sink(): BackupByteSink {
    this.bytes = new Uint8Array();
    return {
      write: async (chunk) => {
        const next = new Uint8Array(this.bytes.length + chunk.length);
        next.set(this.bytes); next.set(chunk, this.bytes.length); this.bytes = next;
      },
      close: async () => undefined,
      abort: async () => { this.bytes = new Uint8Array(); },
    };
  }
  remove() { this.events.push(`remove:${this.uri}`); this.bytes = new Uint8Array(); }
}

function fakeDatabase(): Database {
  return {
    execAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
    closeAsync: jest.fn(),
    serializeAsync: jest.fn(async () => snapshotBytes),
  };
}
