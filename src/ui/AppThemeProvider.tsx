import { createContext, type PropsWithChildren, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme } from '../theme';

type AppTheme = ReturnType<typeof getTheme>;

const AppThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: 'light' | 'dark' }>) {
  const systemScheme = useColorScheme();
  return (
    <AppThemeContext.Provider value={getTheme(scheme ?? systemScheme)}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error('useAppTheme must be used within AppThemeProvider');
  return theme;
}
