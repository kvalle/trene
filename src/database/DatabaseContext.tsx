import { createContext, Fragment, type PropsWithChildren, useContext, useSyncExternalStore } from 'react';

import type { DatabaseRuntime } from './DatabaseRuntime';
import type { DatabaseSource } from './types';

const DatabaseContext = createContext<DatabaseSource | null>(null);

export function DatabaseProvider({
  children,
  database,
}: PropsWithChildren<{ database: DatabaseSource }>) {
  const runtime = 'subscribe' in database ? database as DatabaseRuntime : null;
  const generation = useSyncExternalStore(
    runtime?.subscribe ?? emptySubscribe,
    runtime?.getGeneration ?? zeroGeneration,
  );
  return (
    <DatabaseContext.Provider value={database}>
      <Fragment key={generation}>{children}</Fragment>
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseSource {
  const database = useContext(DatabaseContext);
  if (!database) {
    throw new Error('useDatabase must be used after startup has completed');
  }
  return database;
}

export function useDatabaseRuntime(): DatabaseRuntime {
  const database = useContext(DatabaseContext);
  if (!database || !('runExclusive' in database)) {
    throw new Error('useDatabaseRuntime requires the application database runtime');
  }
  return database as DatabaseRuntime;
}

const emptySubscribe = () => () => undefined;
const zeroGeneration = () => 0;
