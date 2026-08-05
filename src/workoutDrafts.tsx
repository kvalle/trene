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

type WorkoutDrafts = {
  drafts: Record<number, WorkoutSetDraft>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<number, WorkoutSetDraft>>>;
};

const WorkoutDraftContext = createContext<WorkoutDrafts | null>(null);

export function WorkoutDraftProvider({
  children,
  initialDrafts = {},
}: PropsWithChildren<{ initialDrafts?: Record<number, WorkoutSetDraft> }>) {
  const [drafts, setDrafts] = useState<Record<number, WorkoutSetDraft>>(initialDrafts);
  return (
    <WorkoutDraftContext.Provider value={{ drafts, setDrafts }}>
      {children}
    </WorkoutDraftContext.Provider>
  );
}

export function useWorkoutDrafts(): WorkoutDrafts {
  const value = useContext(WorkoutDraftContext);
  if (!value) throw new Error('useWorkoutDrafts must be used within WorkoutDraftProvider');
  return value;
}
