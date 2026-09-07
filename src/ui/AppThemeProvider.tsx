import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import {
  type AppearancePreference,
  type AppearancePreferenceStore,
} from '../preferences/appearancePreference';
import { getTheme } from '../theme';

type AppTheme = ReturnType<typeof getTheme>;
type AppThemeContextValue = AppTheme & {
  changingPreference: boolean;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => Promise<boolean>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({
  children,
  scheme,
  store,
}: PropsWithChildren<{ scheme?: 'light' | 'dark'; store?: AppearancePreferenceStore }>) {
  const systemScheme = useColorScheme();
  const [storedPreference, setStoredPreference] = useState<AppearancePreference | null>(scheme ?? (store ? null : 'system'));
  const [changingPreference, setChangingPreference] = useState(false);
  const preference = scheme ?? storedPreference;
  const operation = useRef(0);
  const writeInProgress = useRef(false);
  const backgroundUpdates = useRef(Promise.resolve());

  useEffect(() => {
    if (scheme || !store) return;
    let active = true;
    store.read().then(
      (value) => { if (active) setStoredPreference(value); },
      () => { if (active) setStoredPreference('system'); },
    );
    return () => { active = false; };
  }, [scheme, store]);

  const resolvedScheme = preference === 'system' ? systemScheme : preference;
  const theme = getTheme(resolvedScheme);

  useEffect(() => {
    if (!preference) return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    backgroundUpdates.current = backgroundUpdates.current
      .then(() => SystemUI.setBackgroundColorAsync(theme.colors.background))
      .catch(() => undefined);
  }, [preference, theme.colors.background]);

  if (!preference) return null;

  async function setPreference(nextPreference: AppearancePreference) {
    if (scheme || !store || !storedPreference || writeInProgress.current || nextPreference === storedPreference) return true;
    const previousPreference = storedPreference;
    const currentOperation = ++operation.current;
    writeInProgress.current = true;
    setChangingPreference(true);
    setStoredPreference(nextPreference);
    try {
      await store.write(nextPreference);
      return true;
    } catch {
      if (operation.current === currentOperation) setStoredPreference(previousPreference);
      return false;
    } finally {
      writeInProgress.current = false;
      setChangingPreference(false);
    }
  }

  return (
    <AppThemeContext.Provider value={{ ...theme, changingPreference, preference, setPreference }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error('useAppTheme must be used within AppThemeProvider');
  return theme;
}
