import { createContext, type PropsWithChildren, useCallback, useContext, useState } from 'react';

type TrainingDataDeletionStatus = {
  deleted: boolean;
  clearDeleted: () => void;
  reportDeleted: () => void;
};

const TrainingDataDeletionContext = createContext<TrainingDataDeletionStatus | null>(null);

export function TrainingDataDeletionProvider({ children }: PropsWithChildren) {
  const [deleted, setDeleted] = useState(false);
  const clearDeleted = useCallback(() => setDeleted(false), []);
  const reportDeleted = useCallback(() => setDeleted(true), []);
  return (
    <TrainingDataDeletionContext.Provider value={{ deleted, clearDeleted, reportDeleted }}>
      {children}
    </TrainingDataDeletionContext.Provider>
  );
}

export function useTrainingDataDeletionStatus(): TrainingDataDeletionStatus {
  const value = useContext(TrainingDataDeletionContext);
  if (!value) throw new Error('useTrainingDataDeletionStatus must be used within TrainingDataDeletionProvider');
  return value;
}
