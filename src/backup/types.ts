export interface BackupByteSource {
  size: number;
  open(): AsyncIterable<Uint8Array>;
}

export interface BackupArchiveReader {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface BackupByteSink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface BackupComponentInput {
  path: string;
  type: string;
  source: BackupByteSource;
  optional?: boolean;
  namespace?: string;
}

export interface BackupPackageInput {
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  tableCounts: Record<string, number>;
  database: BackupByteSource;
  optionalComponents?: BackupComponentInput[];
}

export interface BackupManifestComponent {
  path: string;
  type: string;
  size: number;
  sha256: string;
  optional?: true;
  namespace?: string;
}

export interface BackupManifestV1 {
  formatVersion: 1;
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  components: BackupManifestComponent[];
  tableCounts: Record<string, number>;
}

export interface BackupInspectionLimits {
  maxEntries: number;
  maxManifestBytes: number;
  maxPathDepth: number;
  maxPathBytes: number;
  maxArchiveMetadataBytes: number;
  maxExpansionRatio: number;
  maxCompressedBytes: number;
  maxUncompressedBytes: number;
  readChunkBytes: number;
}

export interface InspectBackupOptions {
  limits?: Partial<BackupInspectionLimits>;
  understoodOptionalNamespaces?: ReadonlySet<string>;
  createComponentSink(path: string): Promise<BackupByteSink>;
}

export type BackupInspectionResult =
  | {
      status: 'valid';
      manifest: BackupManifestV1;
      extractedPaths: string[];
      ignoredOptionalPaths: string[];
    }
  | { status: 'update-required'; formatVersion: number };

export type BackupPackageErrorCode =
  | 'malformed-archive'
  | 'malformed-manifest'
  | 'unsafe-archive'
  | 'integrity-mismatch'
  | 'resource-limit'
  | 'unsupported-component';

export class BackupPackageError extends Error {
  constructor(
    public readonly code: BackupPackageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupPackageError';
  }
}
