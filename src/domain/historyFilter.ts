/** Longest filter summary that lists kontekst names before falling back to a count. */
export const MAX_FILTER_SUMMARY_LENGTH = 40;

export type HistoryFilterContext = { id: number; name: string };

/**
 * The kontekster shown in history. The filter only applies when at least two
 * kontekster have history; hidden ids that are unknown are ignored, and at
 * least one kontekst always stays selected.
 */
export function selectedHistoryContexts(contextIds: number[], hiddenIds: ReadonlySet<number>): Set<number> {
  if (contextIds.length < 2) return new Set(contextIds);
  const selected = contextIds.filter((id) => !hiddenIds.has(id));
  return new Set(selected.length > 0 ? selected : contextIds);
}

/** Toggles one kontekst, keeping at least one selected. Returns the new hidden ids. */
export function toggleHistoryContext(
  contextIds: number[],
  hiddenIds: ReadonlySet<number>,
  id: number,
): Set<number> {
  const selected = selectedHistoryContexts(contextIds, hiddenIds);
  const hidden = new Set(hiddenIds);
  if (selected.has(id)) {
    if (selected.size === 1) return hidden;
    hidden.add(id);
  } else {
    hidden.delete(id);
  }
  return hidden;
}

export function historyFilterSummary(contexts: HistoryFilterContext[], selected: ReadonlySet<number>): string {
  const names = contexts.filter((context) => selected.has(context.id)).map((context) => context.name);
  if (names.length === contexts.length) return 'Viser alle kontekster';
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}` : names[0];
  const listed = `Viser kun ${joined}`;
  return listed.length <= MAX_FILTER_SUMMARY_LENGTH ? listed : `Viser ${names.length} valgte kontekster`;
}
