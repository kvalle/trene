import type { Database, DatabaseAccess, DatabaseValue } from './types';

export class DatabaseMaintenanceError extends Error {
  constructor() {
    super('Database maintenance is in progress');
    this.name = 'DatabaseMaintenanceError';
  }
}

export interface DatabaseMaintenance {
  run<T>(operation: (database: Database) => Promise<T>): Promise<T>;
  reopen(): Promise<void>;
}

export class DatabaseRuntime implements DatabaseAccess {
  private database: Database | null = null;
  private generation = 0;
  private pendingGenerations = 0;
  private started = false;
  private activeOperations = 0;
  private maintenance = false;
  private closed = false;
  private closing: Promise<void> | null = null;
  private starting: Promise<void> | null = null;
  private maintenanceFinished: Promise<void> | null = null;
  private drainWaiters: Array<() => void> = [];
  private listeners = new Set<() => void>();

  constructor(private readonly openDatabase: () => Promise<Database>) {}

  getGeneration = (): number => this.generation;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async start(): Promise<void> {
    if (this.closed) throw new Error('Database runtime is closed');
    if (this.maintenance) throw new DatabaseMaintenanceError();
    if (this.database) return;
    if (this.started) throw new Error('Database is not available');
    if (!this.starting) {
      this.starting = this.performStart().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  async runOperation<T>(operation: (database: Database) => Promise<T>): Promise<T> {
    if (this.closed) throw new Error('Database runtime is closed');
    if (this.maintenance) throw new DatabaseMaintenanceError();
    const database = this.requireDatabase();
    this.activeOperations += 1;
    const lease = leasedDatabase(database);
    try {
      return await operation(lease.database);
    } finally {
      lease.expire();
      await lease.drain();
      this.activeOperations -= 1;
      if (this.activeOperations === 0) {
        const waiters = this.drainWaiters;
        this.drainWaiters = [];
        waiters.forEach((resolve) => resolve());
      }
    }
  }

  async runExclusive<T>(operation: (maintenance: DatabaseMaintenance) => Promise<T>): Promise<T> {
    if (this.starting) await this.starting;
    if (this.closed) throw new Error('Database runtime is closed');
    if (this.maintenance) throw new DatabaseMaintenanceError();
    this.maintenance = true;
    let finishMaintenance!: () => void;
    this.maintenanceFinished = new Promise((resolve) => {
      finishMaintenance = resolve;
    });
    await this.waitForOperations();

    let active = true;
    const assertActive = () => {
      if (!active) throw new Error('Database maintenance lease has expired');
    };
    let maintenanceWork = Promise.resolve();
    const schedule = <R>(work: () => Promise<R>): Promise<R> => {
      try {
        assertActive();
      } catch (error) {
        return Promise.reject(error);
      }
      const result = maintenanceWork.then(work);
      maintenanceWork = result.then(() => undefined, () => undefined);
      return result;
    };
    const maintenance: DatabaseMaintenance = {
      run: <R>(callback: (database: Database) => Promise<R>) => schedule(async () => {
        const lease = leasedDatabase(this.requireDatabase());
        try {
          return await callback(lease.database);
        } finally {
          lease.expire();
          await lease.drain();
        }
      }),
      reopen: () => schedule(() => this.reopen()),
    };

    try {
      return await operation(maintenance);
    } finally {
      active = false;
      await maintenanceWork;
      this.maintenance = false;
      this.maintenanceFinished = null;
      finishMaintenance();
      if (this.pendingGenerations > 0) {
        this.generation += this.pendingGenerations;
        this.pendingGenerations = 0;
        this.listeners.forEach((listener) => listener());
      }
    }
  }

  async close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = this.performClose();
    return this.closing;
  }

  private async reopen(): Promise<void> {
    if (this.closed) throw new Error('Database runtime is closed');
    const previous = this.database;
    this.database = null;
    if (previous) await previous.closeAsync();
    const next = await this.openDatabase();
    if (this.closed) {
      await next.closeAsync();
      throw new Error('Database runtime is closed');
    }
    this.database = next;
    this.pendingGenerations += 1;
  }

  private async performStart(): Promise<void> {
    const database = await this.openDatabase();
    if (this.closed) {
      await database.closeAsync();
      throw new Error('Database runtime is closed');
    }
    this.database = database;
    this.started = true;
  }

  private async performClose(): Promise<void> {
    this.closed = true;
    this.maintenance = true;
    if (this.maintenanceFinished) await this.maintenanceFinished;
    await this.waitForOperations();
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        // Startup owns closing a connection that resolves after shutdown begins.
      }
    }
    const database = this.database;
    this.database = null;
    if (database) await database.closeAsync();
  }

  private requireDatabase(): Database {
    if (this.closed) throw new Error('Database runtime is closed');
    if (!this.database) throw new Error('Database is not available');
    return this.database;
  }

  private waitForOperations(): Promise<void> {
    if (this.activeOperations === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.push(resolve));
  }
}

function leasedDatabase(database: Database): {
  database: Database;
  drain: () => Promise<void>;
  expire: () => void;
} {
  let active = true;
  const pending = new Set<Promise<unknown>>();
  const assertActive = () => {
    if (!active) throw new Error('Database operation lease has expired');
  };
  const track = <T>(operation: Promise<T>): Promise<T> => {
    pending.add(operation);
    void operation.finally(() => pending.delete(operation)).catch(() => undefined);
    return operation;
  };
  return {
    database: {
      closeAsync: async () => {
        throw new Error('Only the database runtime can close the active database');
      },
      execAsync: (source) => {
        try {
          assertActive();
        } catch (error) {
          return Promise.reject(error);
        }
        return track(database.execAsync(source));
      },
      getFirstAsync: <T>(source: string, ...params: DatabaseValue[]) => {
        try {
          assertActive();
        } catch (error) {
          return Promise.reject(error);
        }
        return track(database.getFirstAsync<T>(source, ...params));
      },
      getAllAsync: <T>(source: string, ...params: DatabaseValue[]) => {
        try {
          assertActive();
        } catch (error) {
          return Promise.reject(error);
        }
        return track(database.getAllAsync<T>(source, ...params));
      },
      runAsync: (source, ...params) => {
        try {
          assertActive();
        } catch (error) {
          return Promise.reject(error);
        }
        return track(database.runAsync(source, ...params));
      },
      ...(database.serializeAsync ? {
        serializeAsync: (databaseName?: string) => {
          try {
            assertActive();
          } catch (error) {
            return Promise.reject(error);
          }
          return track(database.serializeAsync!(databaseName));
        },
      } : {}),
    },
    drain: async () => {
      await Promise.allSettled([...pending]);
    },
    expire: () => {
      active = false;
    },
  };
}
