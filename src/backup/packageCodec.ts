import { Inflate, strFromU8, strToU8 } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import {
  BackupArchiveReader,
  BackupByteSink,
  BackupByteSource,
  BackupInspectionLimits,
  BackupInspectionResult,
  BackupManifestComponent,
  BackupManifestV1,
  BackupPackageError,
  BackupPackageInput,
  InspectBackupOptions,
} from './types';
import { parseManifestV1, readFormatVersion } from './manifest';

export const BACKUP_FORMAT_VERSION = 1;

export const DEFAULT_BACKUP_INSPECTION_LIMITS: BackupInspectionLimits = {
  maxEntries: 64,
  maxManifestBytes: 256 * 1024,
  maxPathDepth: 8,
  maxPathBytes: 1024,
  maxArchiveMetadataBytes: 16 * 1024 * 1024,
  maxExpansionRatio: 200,
  maxCompressedBytes: Number.MAX_SAFE_INTEGER,
  maxUncompressedBytes: Number.MAX_SAFE_INTEGER,
  readChunkBytes: 64 * 1024,
};

const textEncoder = new TextEncoder();
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const DATA_DESCRIPTOR_FLAG = 0x0008;

interface ArchiveEntry {
  path: string;
  flags: number;
  method: number;
  crc32: number;
  compressedSize: number;
  size: number;
  localOffset: number;
  externalAttributes: number;
  madeBy: number;
}

interface ArchiveDirectory {
  entries: ArchiveEntry[];
  offset: number;
}

interface SourceMetadata {
  size: number;
  sha256: string;
  crc32: number;
}

function fail(code: ConstructorParameters<typeof BackupPackageError>[0], message: string): never {
  throw new BackupPackageError(code, message);
}

function uint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (uint16(bytes, offset) | (uint16(bytes, offset + 2) << 16)) >>> 0;
}

function uint64(bytes: Uint8Array, offset: number): number {
  const value = BigInt(uint32(bytes, offset)) | (BigInt(uint32(bytes, offset + 4)) << 32n);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('resource-limit', 'ZIP64 value exceeds safe integer range');
  return Number(value);
}

function encodeUint16(value: number): Uint8Array {
  return Uint8Array.of(value & 255, (value >>> 8) & 255);
}

function encodeUint32(value: number): Uint8Array {
  return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function encodeUint64(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) fail('resource-limit', 'Invalid ZIP64 value');
  const wide = BigInt(value);
  return concat(encodeUint32(Number(wide & 0xffffffffn)), encodeUint32(Number(wide >> 32n)));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeUtf8(bytes: Uint8Array, description: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('malformed-archive', `${description} is not valid UTF-8`);
  }
}

function decodeZipPath(bytes: Uint8Array, flags: number): string {
  if ((flags & UTF8_FLAG) !== 0) return decodeUtf8(bytes, 'Archive path');
  if (bytes.some((byte) => byte > 0x7f)) {
    fail('unsafe-archive', 'Non-ASCII archive paths must declare UTF-8');
  }
  return String.fromCharCode(...bytes);
}

let crcTable: Uint32Array | undefined;
function updateCrc32(crc: number, bytes: Uint8Array): number {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let value = crc ^ 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

async function inspectSource(source: BackupByteSource): Promise<SourceMetadata> {
  if (!Number.isSafeInteger(source.size) || source.size < 0) {
    fail('resource-limit', 'Component size is outside safe integer limits');
  }
  const hash = sha256.create();
  let size = 0;
  let crc32 = 0;
  for await (const chunk of source.open()) {
    size += chunk.length;
    if (size > source.size) fail('integrity-mismatch', 'Component source exceeded its declared size');
    hash.update(chunk);
    crc32 = updateCrc32(crc32, chunk);
  }
  if (size !== source.size) fail('integrity-mismatch', 'Component source size changed while packaging');
  return { size, sha256: toHex(hash.digest()), crc32 };
}

function validatePath(path: string, limits: BackupInspectionLimits): void {
  const bytes = textEncoder.encode(path);
  const parts = path.replaceAll('\\', '/').split('/');
  if (
    path.length === 0 ||
    path.includes('\0') ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z]:/.test(path) ||
    path.includes('\\') ||
    parts.some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail('unsafe-archive', `Unsafe archive path: ${path}`);
  }
  if (parts.length > limits.maxPathDepth || bytes.length > limits.maxPathBytes) {
    fail('resource-limit', `Archive path exceeds configured limits: ${path}`);
  }
}

function stableManifest(manifest: BackupManifestV1): Uint8Array {
  return strToU8(`${JSON.stringify(manifest)}\n`);
}

function localHeader(path: Uint8Array, metadata: SourceMetadata): Uint8Array {
  const zip64 = metadata.size >= 0xffffffff;
  const extra = zip64
    ? concat(encodeUint16(1), encodeUint16(16), encodeUint64(metadata.size), encodeUint64(metadata.size))
    : new Uint8Array();
  return concat(
    encodeUint32(LOCAL_SIGNATURE),
    encodeUint16(zip64 ? 45 : 20),
    encodeUint16(UTF8_FLAG),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint16(0x21),
    encodeUint32(metadata.crc32),
    encodeUint32(zip64 ? 0xffffffff : metadata.size),
    encodeUint32(zip64 ? 0xffffffff : metadata.size),
    encodeUint16(path.length),
    encodeUint16(extra.length),
    path,
    extra,
  );
}

function centralHeader(path: Uint8Array, metadata: SourceMetadata, offset: number): Uint8Array {
  const largeSize = metadata.size >= 0xffffffff;
  const largeOffset = offset >= 0xffffffff;
  const zip64Values = [
    ...(largeSize ? [metadata.size, metadata.size] : []),
    ...(largeOffset ? [offset] : []),
  ];
  const extra = zip64Values.length > 0
    ? concat(
        encodeUint16(1),
        encodeUint16(zip64Values.length * 8),
        ...zip64Values.map(encodeUint64),
      )
    : new Uint8Array();
  return concat(
    encodeUint32(CENTRAL_SIGNATURE),
    encodeUint16(0x031e),
    encodeUint16(zip64Values.length > 0 ? 45 : 20),
    encodeUint16(UTF8_FLAG),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint16(0x21),
    encodeUint32(metadata.crc32),
    encodeUint32(largeSize ? 0xffffffff : metadata.size),
    encodeUint32(largeSize ? 0xffffffff : metadata.size),
    encodeUint16(path.length),
    encodeUint16(extra.length),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint32(0o100600 << 16),
    encodeUint32(largeOffset ? 0xffffffff : offset),
    path,
    extra,
  );
}

export async function createBackupPackage(
  input: BackupPackageInput,
  sink: BackupByteSink,
): Promise<BackupManifestV1> {
  const components = [
    { path: 'database.sqlite', type: 'sqlite-database', source: input.database },
    ...(input.optionalComponents ?? []),
  ];
  const createLimits = DEFAULT_BACKUP_INSPECTION_LIMITS;
  if (components.length + 1 > createLimits.maxEntries) {
    fail('resource-limit', 'Package has too many entries');
  }
  const metadata: SourceMetadata[] = [];

  for (const component of components) {
    validatePath(component.path, createLimits);
    if (component.optional) {
      if (!component.namespace || !component.path.startsWith(`extensions/${component.namespace}/`)) {
        fail('malformed-manifest', 'Optional components require a namespaced extension path');
      }
    } else if (component.path !== 'database.sqlite') {
      fail('unsupported-component', 'Format 1 only supports the mandatory database component');
    }
    metadata.push(await inspectSource(component.source));
  }

  const manifestComponents: BackupManifestComponent[] = components.map((component, index) => ({
    path: component.path,
    type: component.type,
    size: metadata[index]!.size,
    sha256: metadata[index]!.sha256,
    ...(component.optional ? { optional: true as const, namespace: component.namespace } : {}),
  }));
  const manifest: BackupManifestV1 = {
    formatVersion: 1,
    schemaVersion: input.schemaVersion,
    appVersion: input.appVersion,
    createdAt: input.createdAt,
    components: manifestComponents,
    tableCounts: input.tableCounts,
  };
  parseManifestV1(manifest);

  const manifestBytes = stableManifest(manifest);
  const manifestMetadata: SourceMetadata = {
    size: manifestBytes.length,
    sha256: toHex(sha256(manifestBytes)),
    crc32: updateCrc32(0, manifestBytes),
  };
  const entries = [
    { path: 'manifest.json', source: undefined, metadata: manifestMetadata },
    ...components.map((component, index) => ({ path: component.path, source: component.source, metadata: metadata[index]! })),
  ];
  if (manifestBytes.length > createLimits.maxManifestBytes) {
    fail('resource-limit', 'Manifest exceeds format-1 creation limits');
  }

  try {
    let offset = 0;
    const central: Uint8Array[] = [];
    for (const entry of entries) {
      const path = strToU8(entry.path);
      const header = localHeader(path, entry.metadata);
      await sink.write(header);
      central.push(centralHeader(path, entry.metadata, offset));
      offset += header.length + entry.metadata.size;
      if (!Number.isSafeInteger(offset)) fail('resource-limit', 'Package exceeds safe integer limits');
      if (entry.source) {
        let written = 0;
        let crc32 = 0;
        const hash = sha256.create();
        for await (const chunk of entry.source.open()) {
          written += chunk.length;
          if (written > entry.metadata.size) fail('integrity-mismatch', 'Component changed while writing package');
          crc32 = updateCrc32(crc32, chunk);
          hash.update(chunk);
          await sink.write(chunk);
        }
        if (
          written !== entry.metadata.size ||
          crc32 !== entry.metadata.crc32 ||
          toHex(hash.digest()) !== entry.metadata.sha256
        ) {
          fail('integrity-mismatch', 'Component changed while writing package');
        }
      } else {
        await sink.write(manifestBytes);
      }
    }
    const centralOffset = offset;
    for (const header of central) {
      await sink.write(header);
      offset += header.length;
    }
    const centralSize = offset - centralOffset;
    if (!Number.isSafeInteger(offset)) fail('resource-limit', 'Package exceeds safe integer limits');
    if (centralOffset >= 0xffffffff || centralSize >= 0xffffffff) {
      const zip64EocdOffset = offset;
      const zip64Eocd = concat(
        encodeUint32(ZIP64_EOCD_SIGNATURE),
        encodeUint64(44),
        encodeUint16(45),
        encodeUint16(45),
        encodeUint32(0),
        encodeUint32(0),
        encodeUint64(entries.length),
        encodeUint64(entries.length),
        encodeUint64(centralSize),
        encodeUint64(centralOffset),
      );
      await sink.write(zip64Eocd);
      await sink.write(
        concat(
          encodeUint32(ZIP64_LOCATOR_SIGNATURE),
          encodeUint32(0),
          encodeUint64(zip64EocdOffset),
          encodeUint32(1),
        ),
      );
      offset += zip64Eocd.length + 20;
    }
    await sink.write(
      concat(
        encodeUint32(EOCD_SIGNATURE),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint16(entries.length),
        encodeUint16(entries.length),
        encodeUint32(centralSize >= 0xffffffff ? 0xffffffff : centralSize),
        encodeUint32(centralOffset >= 0xffffffff ? 0xffffffff : centralOffset),
        encodeUint16(0),
      ),
    );
    await sink.close();
    return manifest;
  } catch (error) {
    await sink.abort();
    throw error;
  }
}

async function readExact(reader: BackupArchiveReader, offset: number, length: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > reader.size) {
    fail('malformed-archive', 'Archive offset is outside the file');
  }
  const bytes = await reader.read(offset, length);
  if (bytes.length !== length) fail('malformed-archive', 'Archive ended unexpectedly');
  return bytes;
}

async function readEntries(reader: BackupArchiveReader, limits: BackupInspectionLimits): Promise<ArchiveDirectory> {
  if (reader.size < 22) fail('malformed-archive', 'Archive is too short');
  const tailLength = Math.min(reader.size, 22 + 0xffff);
  const tailOffset = reader.size - tailLength;
  const tail = await readExact(reader, tailOffset, tailLength);
  let eocd = -1;
  for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
    if (uint32(tail, offset) === EOCD_SIGNATURE && offset + 22 + uint16(tail, offset + 20) === tail.length) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) fail('malformed-archive', 'Missing ZIP end record');
  if (uint16(tail, eocd + 4) !== 0 || uint16(tail, eocd + 6) !== 0) fail('unsafe-archive', 'Multi-disk ZIP archives are not supported');
  const count = uint16(tail, eocd + 10);
  if (count !== uint16(tail, eocd + 8)) fail('malformed-archive', 'Inconsistent ZIP entry count');
  if (count > limits.maxEntries) fail('resource-limit', 'Archive has too many entries');
  let centralSize = uint32(tail, eocd + 12);
  let centralOffset = uint32(tail, eocd + 16);
  let directoryEnd = tailOffset + eocd;
  if (centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    if (directoryEnd < 20) fail('malformed-archive', 'Missing ZIP64 locator');
    const locator = await readExact(reader, directoryEnd - 20, 20);
    if (uint32(locator, 0) !== ZIP64_LOCATOR_SIGNATURE || uint32(locator, 4) !== 0 || uint32(locator, 16) !== 1) {
      fail('malformed-archive', 'Invalid ZIP64 locator');
    }
    const zip64Offset = uint64(locator, 8);
    const zip64 = await readExact(reader, zip64Offset, 56);
    if (uint32(zip64, 0) !== ZIP64_EOCD_SIGNATURE || uint64(zip64, 4) !== 44) {
      fail('malformed-archive', 'Invalid ZIP64 end record');
    }
    centralSize = uint64(zip64, 40);
    centralOffset = uint64(zip64, 48);
    directoryEnd = zip64Offset;
  }
  if (centralOffset + centralSize !== directoryEnd) fail('malformed-archive', 'Invalid ZIP central directory');
  if (centralSize > limits.maxArchiveMetadataBytes) {
    fail('resource-limit', 'ZIP central directory exceeds configured metadata limit');
  }
  const central = await readExact(reader, centralOffset, centralSize);
  const entries: ArchiveEntry[] = [];
  const paths = new Set<string>();
  let offset = 0;
  let compressedTotal = 0;
  let uncompressedTotal = 0;
  while (offset < central.length) {
    if (offset + 46 > central.length || uint32(central, offset) !== CENTRAL_SIGNATURE) fail('malformed-archive', 'Malformed ZIP central entry');
    const nameLength = uint16(central, offset + 28);
    const extraLength = uint16(central, offset + 30);
    const commentLength = uint16(central, offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > central.length) fail('malformed-archive', 'Truncated ZIP central entry');
    const flags = uint16(central, offset + 8);
    const method = uint16(central, offset + 10);
    const path = decodeZipPath(
      central.subarray(offset + 46, offset + 46 + nameLength),
      flags,
    );
    validatePath(path, limits);
    if (paths.has(path)) fail('unsafe-archive', `Duplicate archive entry: ${path}`);
    paths.add(path);
    if (flags & ENCRYPTED_FLAG) fail('unsafe-archive', `Encrypted archive entry: ${path}`);
    if (flags & DATA_DESCRIPTOR_FLAG) fail('unsafe-archive', `Data descriptors are not accepted: ${path}`);
    if (method !== 0 && method !== 8) fail('unsafe-archive', `Unsupported compression method: ${path}`);
    let compressedSize = uint32(central, offset + 20);
    let size = uint32(central, offset + 24);
    let localOffset = uint32(central, offset + 42);
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      const extra = central.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength);
      let extraOffset = 0;
      let zip64: Uint8Array | undefined;
      while (extraOffset + 4 <= extra.length) {
        const id = uint16(extra, extraOffset);
        const length = uint16(extra, extraOffset + 2);
        if (extraOffset + 4 + length > extra.length) fail('malformed-archive', 'Malformed ZIP extra field');
        if (id === 1) zip64 = extra.subarray(extraOffset + 4, extraOffset + 4 + length);
        extraOffset += 4 + length;
      }
      if (!zip64) fail('malformed-archive', 'Missing ZIP64 entry metadata');
      let zip64Offset = 0;
      const readZip64Value = (): number => {
        if (zip64Offset + 8 > zip64.length) fail('malformed-archive', 'Truncated ZIP64 entry metadata');
        const value = uint64(zip64, zip64Offset);
        zip64Offset += 8;
        return value;
      };
      if (size === 0xffffffff) size = readZip64Value();
      if (compressedSize === 0xffffffff) compressedSize = readZip64Value();
      if (localOffset === 0xffffffff) localOffset = readZip64Value();
    }
    if (compressedSize === 0 && size > 0) fail('resource-limit', `Invalid expansion ratio: ${path}`);
    if (compressedSize > 0 && size / compressedSize > limits.maxExpansionRatio) fail('resource-limit', `Expansion ratio exceeded: ${path}`);
    compressedTotal += compressedSize;
    uncompressedTotal += size;
    if (compressedTotal > limits.maxCompressedBytes || uncompressedTotal > limits.maxUncompressedBytes) fail('resource-limit', 'Archive byte limit exceeded');
    const madeBy = uint16(central, offset + 4);
    const externalAttributes = uint32(central, offset + 38);
    const unixMode = madeBy >>> 8 === 3 ? externalAttributes >>> 16 : 0;
    if ((unixMode & 0o170000) === 0o120000) fail('unsafe-archive', `Symbolic link entry: ${path}`);
    entries.push({
      path,
      flags,
      method,
      crc32: uint32(central, offset + 16),
      compressedSize,
      size,
      localOffset,
      externalAttributes,
      madeBy,
    });
    offset = end;
  }
  if (entries.length !== count) fail('malformed-archive', 'ZIP entry count does not match directory');
  return { entries, offset: centralOffset };
}

async function entryDataOffset(reader: BackupArchiveReader, entry: ArchiveEntry): Promise<number> {
  const local = await readExact(reader, entry.localOffset, 30);
  const localCompressedSize = uint32(local, 18);
  const localSize = uint32(local, 22);
  if (
    uint32(local, 0) !== LOCAL_SIGNATURE ||
    uint16(local, 6) !== entry.flags ||
    uint16(local, 8) !== entry.method ||
    uint32(local, 14) !== entry.crc32 ||
    (localCompressedSize !== 0xffffffff && localCompressedSize !== entry.compressedSize) ||
    (localSize !== 0xffffffff && localSize !== entry.size)
  ) {
    fail('malformed-archive', `Local ZIP metadata differs for ${entry.path}`);
  }
  const nameLength = uint16(local, 26);
  const extraLength = uint16(local, 28);
  const name = decodeZipPath(
    await readExact(reader, entry.localOffset + 30, nameLength),
    entry.flags,
  );
  if (name !== entry.path) fail('malformed-archive', `Local ZIP path differs for ${entry.path}`);
  if (localSize === 0xffffffff || localCompressedSize === 0xffffffff) {
    const extra = await readExact(reader, entry.localOffset + 30 + nameLength, extraLength);
    if (extra.length < 20 || uint16(extra, 0) !== 1 || uint16(extra, 2) < 16) {
      fail('malformed-archive', `Missing local ZIP64 metadata for ${entry.path}`);
    }
    if (uint64(extra, 4) !== entry.size || uint64(extra, 12) !== entry.compressedSize) {
      fail('malformed-archive', `Local ZIP64 metadata differs for ${entry.path}`);
    }
  }
  return entry.localOffset + 30 + nameLength + extraLength;
}

class MemorySink implements BackupByteSink {
  chunks: Uint8Array[] = [];
  size = 0;
  async write(chunk: Uint8Array): Promise<void> {
    this.chunks.push(chunk.slice());
    this.size += chunk.length;
  }
  async close(): Promise<void> {}
  async abort(): Promise<void> {
    this.chunks = [];
    this.size = 0;
  }
  bytes(): Uint8Array {
    return concat(...this.chunks);
  }
}

class DiscardSink implements BackupByteSink {
  async write(_chunk: Uint8Array): Promise<void> {}
  async close(): Promise<void> {}
  async abort(): Promise<void> {}
}

async function extractEntry(
  reader: BackupArchiveReader,
  entry: ArchiveEntry,
  sink: BackupByteSink,
  chunkSize: number,
  expectedSha256?: string,
): Promise<{ size: number; sha256: string }> {
  const start = await entryDataOffset(reader, entry);
  const hash = sha256.create();
  let size = 0;
  let crc32 = 0;
  const consume = async (chunk: Uint8Array): Promise<void> => {
    size += chunk.length;
    if (size > entry.size) fail('integrity-mismatch', `Expanded size exceeded for ${entry.path}`);
    hash.update(chunk);
    crc32 = updateCrc32(crc32, chunk);
    await sink.write(chunk);
  };
  try {
    if (entry.method === 0) {
      for (let offset = 0; offset < entry.compressedSize; offset += chunkSize) {
        await consume(await readExact(reader, start + offset, Math.min(chunkSize, entry.compressedSize - offset)));
      }
    } else {
      const output: Uint8Array[] = [];
      let inflateError: Error | undefined;
      const inflate = new Inflate((chunk, final) => {
        output.push(chunk);
        void final;
      });
      for (let offset = 0; offset < entry.compressedSize; offset += chunkSize) {
        const length = Math.min(chunkSize, entry.compressedSize - offset);
        try {
          inflate.push(await readExact(reader, start + offset, length), offset + length === entry.compressedSize);
        } catch (error) {
          inflateError = error instanceof Error ? error : new Error(String(error));
        }
        if (inflateError) fail('malformed-archive', `Invalid compressed data for ${entry.path}`);
        while (output.length > 0) await consume(output.shift()!);
      }
    }
    if (size !== entry.size || crc32 !== entry.crc32) fail('integrity-mismatch', `ZIP integrity mismatch for ${entry.path}`);
    const digest = toHex(hash.digest());
    if (expectedSha256 !== undefined && digest !== expectedSha256) {
      fail('integrity-mismatch', `SHA-256 mismatch for ${entry.path}`);
    }
    await sink.close();
    return { size, sha256: digest };
  } catch (error) {
    await sink.abort();
    throw error;
  }
}

export async function inspectBackupPackage(
  reader: BackupArchiveReader,
  options: InspectBackupOptions,
): Promise<BackupInspectionResult> {
  const limits = { ...DEFAULT_BACKUP_INSPECTION_LIMITS, ...options.limits };
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    fail('resource-limit', 'Inspection limits must be positive safe integers');
  }
  const directory = await readEntries(reader, limits);
  const entries = directory.entries;
  const ranges = await Promise.all(
    entries.map(async (entry) => ({
      path: entry.path,
      start: entry.localOffset,
      end: (await entryDataOffset(reader, entry)) + entry.compressedSize,
    })),
  );
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]!;
    if (range.end > directory.offset || (index > 0 && range.start < ranges[index - 1]!.end)) {
      fail('malformed-archive', `Overlapping or misplaced ZIP entry: ${range.path}`);
    }
  }
  const manifestEntry = entries.find((entry) => entry.path === 'manifest.json');
  if (!manifestEntry || entries.filter((entry) => entry.path === 'manifest.json').length !== 1) fail('malformed-archive', 'Archive must contain one manifest.json');
  if (manifestEntry.size > limits.maxManifestBytes) fail('resource-limit', 'Manifest exceeds configured size');
  const manifestSink = new MemorySink();
  await extractEntry(reader, manifestEntry, manifestSink, limits.readChunkBytes);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(decodeUtf8(manifestSink.bytes(), 'Manifest'));
  } catch {
    fail('malformed-manifest', 'Manifest is not valid JSON');
  }
  const formatVersion = readFormatVersion(rawManifest);
  if (formatVersion > BACKUP_FORMAT_VERSION) return { status: 'update-required', formatVersion };
  const manifest = parseManifestV1(rawManifest);
  const declared = new Map(manifest.components.map((component) => [component.path, component]));
  for (const entry of entries) {
    if (entry.path !== 'manifest.json' && !declared.has(entry.path)) fail('unsafe-archive', `Undeclared archive entry: ${entry.path}`);
  }
  if (entries.length !== manifest.components.length + 1) fail('malformed-archive', 'Declared component is missing from archive');

  const extractedPaths: string[] = [];
  const ignoredOptionalPaths: string[] = [];
  for (const component of manifest.components) {
    const entry = entries.find((candidate) => candidate.path === component.path);
    if (!entry) fail('malformed-archive', `Missing declared component: ${component.path}`);
    if (entry.size !== component.size) fail('integrity-mismatch', `Declared size mismatch for ${component.path}`);
    const understood = component.optional !== true || options.understoodOptionalNamespaces?.has(component.namespace!) === true;
    const sink = understood ? await options.createComponentSink(component.path) : new DiscardSink();
    await extractEntry(reader, entry, sink, limits.readChunkBytes, component.sha256);
    if (understood) extractedPaths.push(component.path);
    else ignoredOptionalPaths.push(component.path);
  }
  return { status: 'valid', manifest, extractedPaths, ignoredOptionalPaths };
}
