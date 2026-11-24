import { historyFilterSummary, selectedHistoryContexts, toggleHistoryContext } from '../historyFilter';

const contexts = [
  { id: 1, name: 'Standard' },
  { id: 2, name: 'Fysio' },
  { id: 3, name: 'Treningssenter' },
];
const ids = contexts.map(({ id }) => id);

describe('selectedHistoryContexts', () => {
  test('selects every kontekst not hidden, ignoring unknown ids', () => {
    expect(selectedHistoryContexts(ids, new Set([2, 99]))).toEqual(new Set([1, 3]));
  });

  test('ignores the stored selection when fewer than two kontekster have history', () => {
    expect(selectedHistoryContexts([2], new Set([2]))).toEqual(new Set([2]));
    expect(selectedHistoryContexts([], new Set([2]))).toEqual(new Set());
  });

  test('shows new kontekster and falls back to all when everything is hidden', () => {
    expect(selectedHistoryContexts([...ids, 4], new Set([1, 2]))).toEqual(new Set([3, 4]));
    expect(selectedHistoryContexts(ids, new Set(ids))).toEqual(new Set(ids));
  });
});

describe('toggleHistoryContext', () => {
  test('hides and shows a kontekst', () => {
    const hidden = toggleHistoryContext(ids, new Set(), 2);
    expect(hidden).toEqual(new Set([2]));
    expect(toggleHistoryContext(ids, hidden, 2)).toEqual(new Set());
  });

  test('keeps the last selected kontekst', () => {
    expect(toggleHistoryContext(ids, new Set([1, 2]), 3)).toEqual(new Set([1, 2]));
  });

  test('keeps unrelated stored ids', () => {
    expect(toggleHistoryContext(ids, new Set([99]), 1)).toEqual(new Set([99, 1]));
  });
});

describe('historyFilterSummary', () => {
  test('describes all, one, and several selected kontekster', () => {
    expect(historyFilterSummary(contexts, new Set(ids))).toBe('Viser alle kontekster');
    expect(historyFilterSummary(contexts, new Set([2]))).toBe('Viser kun Fysio');
    expect(historyFilterSummary(contexts, new Set([2, 3]))).toBe('Viser kun Fysio og Treningssenter');
  });

  test('joins three names with commas and «og»', () => {
    const four = [...contexts, { id: 4, name: 'Hjemme' }];
    expect(historyFilterSummary(four, new Set([1, 2, 4]))).toBe('Viser kun Standard, Fysio og Hjemme');
  });

  test('falls back to a count when the text exceeds 40 characters', () => {
    const long = [
      { id: 1, name: 'Standard' },
      { id: 2, name: 'Fysioterapi' },
      { id: 3, name: 'Treningssenteret' },
      { id: 4, name: 'Hjemme' },
    ];
    const exactly40 = 'Viser kun Standard og Treningssenteret12';
    expect(exactly40).toHaveLength(40);
    expect(historyFilterSummary(
      [{ id: 1, name: 'Standard' }, { id: 2, name: 'Treningssenteret12' }, { id: 3, name: 'X' }],
      new Set([1, 2]),
    )).toBe(exactly40);
    expect(historyFilterSummary(long, new Set([1, 2, 3]))).toBe('Viser 3 valgte kontekster');
  });
});
