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

export interface DatabaseAccess {
  runOperation<T>(operation: (database: Database) => Promise<T>): Promise<T>;
}

export type DatabaseSource = Database | DatabaseAccess;

export function withDatabase<T>(
  source: DatabaseSource,
  operation: (database: Database) => Promise<T>,
): Promise<T> {
  return 'runOperation' in source ? source.runOperation(operation) : operation(source);
}

export function databaseOperation<Arguments extends unknown[], Result>(
  operation: (database: Database, ...args: Arguments) => Promise<Result>,
): (source: DatabaseSource, ...args: Arguments) => Promise<Result> {
  return (source, ...args) => withDatabase(source, (database) => operation(database, ...args));
}
