import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './AppNavigator';
import { openApplicationDatabase } from './database/openDatabase';
import { StartupGate } from './StartupGate';
import { TrainingDataDeletionProvider } from './trainingDataDeletion';
import { AppThemeProvider } from './ui/AppThemeProvider';

export default function App() {
  return (
    <AppThemeProvider>
      <TrainingDataDeletionProvider>
        <StartupGate openDatabase={openApplicationDatabase}>
          <StatusBar style="auto" />
          <AppNavigator />
        </StartupGate>
      </TrainingDataDeletionProvider>
    </AppThemeProvider>
  );
}
