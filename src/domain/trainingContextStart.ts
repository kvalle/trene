export interface StartableTrainingContext {
  id: number;
  name: string;
  archived: boolean;
  /** Start time of the most recent treningsøkt in the kontekst, if any. */
  lastUsedAt: string | null;
}

export type WorkoutStartDecision<T extends StartableTrainingContext> =
  | { kind: 'direct'; trainingContext: T }
  | { kind: 'choose'; trainingContexts: T[] };

const bokmalCollator = new Intl.Collator('nb', { sensitivity: 'accent' });

/**
 * Orders kontekster with the most recently used first. Kontekster that have
 * never been used follow in Bokmål name order.
 */
export function orderByMostRecentlyUsed<T extends StartableTrainingContext>(trainingContexts: readonly T[]): T[] {
  return [...trainingContexts].sort((left, right) => {
    if (left.lastUsedAt !== right.lastUsedAt) {
      if (left.lastUsedAt === null) return 1;
      if (right.lastUsedAt === null) return -1;
      return left.lastUsedAt < right.lastUsedAt ? 1 : -1;
    }
    return bokmalCollator.compare(left.name, right.name) || left.id - right.id;
  });
}

/**
 * Decides how "Start trening" behaves: start directly in the only active
 * kontekst, or let the user choose among several active kontekster.
 */
export function decideWorkoutStart<T extends StartableTrainingContext>(
  trainingContexts: readonly T[],
): WorkoutStartDecision<T> {
  const active = orderByMostRecentlyUsed(trainingContexts.filter((trainingContext) => !trainingContext.archived));
  if (active.length === 0) throw new Error('No active training context exists');
  return active.length === 1
    ? { kind: 'direct', trainingContext: active[0] }
    : { kind: 'choose', trainingContexts: active };
}
