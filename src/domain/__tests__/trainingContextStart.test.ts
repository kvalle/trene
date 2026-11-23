import { decideWorkoutStart, orderByMostRecentlyUsed } from '../trainingContextStart';

const context = (id: number, name: string, lastUsedAt: string | null, archived = false) => ({
  id, name, lastUsedAt, archived,
});

describe('orderByMostRecentlyUsed', () => {
  test('puts the most recently used first and unused kontekster last in name order', () => {
    const ordered = orderByMostRecentlyUsed([
      context(1, 'Standard', '2026-01-01T10:00:00Z'),
      context(2, 'Øvelser hjemme', null),
      context(3, 'Fysio', '2026-03-01T10:00:00Z'),
      context(4, 'Annet', null),
      context(5, 'Treningssenter', '2026-02-01T10:00:00Z'),
    ]);

    expect(ordered.map(({ name }) => name))
      .toEqual(['Fysio', 'Treningssenter', 'Standard', 'Annet', 'Øvelser hjemme']);
  });
});

describe('decideWorkoutStart', () => {
  test('starts directly in the only active kontekst, ignoring archived ones', () => {
    const standard = context(1, 'Standard', null);
    expect(decideWorkoutStart([standard, context(2, 'Gammel', '2026-01-01', true)]))
      .toEqual({ kind: 'direct', trainingContext: standard });
  });

  test('lets the user choose among several active kontekster, most recently used first', () => {
    const decision = decideWorkoutStart([
      context(1, 'Standard', '2026-01-01'),
      context(2, 'Gammel', '2026-05-01', true),
      context(3, 'Fysio', '2026-02-01'),
    ]);

    expect(decision.kind).toBe('choose');
    expect(decision.kind === 'choose' && decision.trainingContexts.map(({ name }) => name))
      .toEqual(['Fysio', 'Standard']);
  });

  test('rejects having no active kontekst', () => {
    expect(() => decideWorkoutStart([context(1, 'Gammel', null, true)])).toThrow('No active training context');
  });
});
