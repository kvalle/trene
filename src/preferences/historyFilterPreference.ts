import Storage from 'expo-sqlite/kv-store';

/**
 * The kontekster hidden in "Tidligere treninger". Stored as hidden ids, so new
 * kontekster are shown by default. Kept in preferences, not in the training
 * database or backups.
 */
export type HistoryFilterPreferenceStore = {
  read: () => Promise<Set<number>>;
  write: (hiddenIds: ReadonlySet<number>) => Promise<void>;
};

const STORAGE_KEY = 'history-hidden-training-contexts';

function parse(stored: string | null): Set<number> {
  if (!stored) return new Set();
  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((id): id is number => Number.isInteger(id)));
  } catch {
    return new Set();
  }
}

export const historyFilterPreferenceStore: HistoryFilterPreferenceStore = {
  async read() {
    return parse(await Storage.getItem(STORAGE_KEY));
  },
  async write(hiddenIds) {
    await Storage.setItem(STORAGE_KEY, JSON.stringify([...hiddenIds].sort((a, b) => a - b)));
  },
};
