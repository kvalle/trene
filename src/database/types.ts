export type DatabaseValue = string | number | null;

export interface DatabaseRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Database {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: DatabaseValue[]): Promise<T[]>;
  runAsync(source: string, ...params: DatabaseValue[]): Promise<DatabaseRunResult>;
  closeAsync(): Promise<void>;
}
