import { createContext, type PropsWithChildren, useContext, useState } from 'react';

export type WorkoutSetDraft = {
  workoutId: number;
  load: string;
  repetitions: string;
  loadError?: string;
  repetitionsError?: string;
  unsaved?: boolean;
  confirmationFailed?: boolean;
};

type WorkoutSetDrafts = {
  drafts: Record<number, WorkoutSetDraft>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<number, WorkoutSetDraft>>>;
};

const WorkoutSetDraftContext = createContext<WorkoutSetDrafts | null>(null);

export function WorkoutSetDraftProvider({
  children,
  initialDrafts = {},
}: PropsWithChildren<{ initialDrafts?: Record<number, WorkoutSetDraft> }>) {
  const [drafts, setDrafts] = useState<Record<number, WorkoutSetDraft>>(initialDrafts);
  return (
    <WorkoutSetDraftContext.Provider value={{ drafts, setDrafts }}>
      {children}
    </WorkoutSetDraftContext.Provider>
  );
}

export function useWorkoutSetDrafts(): WorkoutSetDrafts {
  const value = useContext(WorkoutSetDraftContext);
  if (!value) throw new Error('useWorkoutSetDrafts must be used within WorkoutSetDraftProvider');
  return value;
}
