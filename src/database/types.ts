export interface Database {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
  closeAsync(): Promise<void>;
}
