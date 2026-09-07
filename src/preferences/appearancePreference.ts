import Storage from 'expo-sqlite/kv-store';

export type AppearancePreference = 'system' | 'light' | 'dark';

export type AppearancePreferenceStore = {
  read: () => Promise<AppearancePreference>;
  write: (preference: AppearancePreference) => Promise<void>;
};

const STORAGE_KEY = 'appearance-preference';

export const appearancePreferenceLabels: Record<AppearancePreference, string> = {
  system: 'Følg telefonen',
  light: 'Lys',
  dark: 'Mørk',
};

export const appearancePreferenceStore: AppearancePreferenceStore = {
  async read() {
    const stored = await Storage.getItem(STORAGE_KEY);
    return isAppearancePreference(stored) ? stored : 'system';
  },
  async write(preference) {
    await Storage.setItem(STORAGE_KEY, preference);
  },
};

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
