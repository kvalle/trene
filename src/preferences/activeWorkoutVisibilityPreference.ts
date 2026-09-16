import Storage from 'expo-sqlite/kv-store';

export type ActiveWorkoutVisibilityPreference = 'enabled' | 'disabled';

export type ActiveWorkoutVisibilityPreferenceStore = {
  read: () => Promise<ActiveWorkoutVisibilityPreference>;
  write: (preference: ActiveWorkoutVisibilityPreference) => Promise<void>;
};

const STORAGE_KEY = 'active-workout-system-visibility';

export const activeWorkoutVisibilityLabels: Record<ActiveWorkoutVisibilityPreference, string> = {
  enabled: 'Vis aktiv trening',
  disabled: 'Ikke vis aktiv trening',
};

export const activeWorkoutVisibilityPreferenceStore: ActiveWorkoutVisibilityPreferenceStore = {
  async read() {
    const stored = await Storage.getItem(STORAGE_KEY);
    return stored === 'disabled' ? 'disabled' : 'enabled';
  },
  async write(preference) {
    await Storage.setItem(STORAGE_KEY, preference);
  },
};
