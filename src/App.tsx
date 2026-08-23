import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './AppNavigator';
import { openApplicationDatabase } from './database/openDatabase';
import { StartupGate } from './StartupGate';
import { AppThemeProvider } from './ui/AppThemeProvider';

export default function App() {
  return (
    <AppThemeProvider>
      <StartupGate openDatabase={openApplicationDatabase}>
        <StatusBar style="auto" />
        <AppNavigator />
      </StartupGate>
    </AppThemeProvider>
  );
}
