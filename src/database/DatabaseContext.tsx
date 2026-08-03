import { createContext, type PropsWithChildren, useContext } from 'react';

import type { Database } from './types';

const DatabaseContext = createContext<Database | null>(null);

export function DatabaseProvider({
  children,
  database,
}: PropsWithChildren<{ database: Database }>) {
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): Database {
  const database = useContext(DatabaseContext);
  if (!database) {
    throw new Error('useDatabase must be used after startup has completed');
  }
  return database;
}
