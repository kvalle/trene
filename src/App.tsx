import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './AppNavigator';
import { openApplicationDatabase } from './database/openDatabase';
import { StartupGate } from './StartupGate';
import { TrainingDataDeletionProvider } from './trainingDataDeletion';
import { AppThemeProvider, useAppTheme } from './ui/AppThemeProvider';
import { appearancePreferenceStore } from './preferences/appearancePreference';
import { ActiveWorkoutVisibilityProvider } from './activeWorkoutVisibility/ActiveWorkoutVisibilityContext';

export default function App() {
  return (
    <AppThemeProvider store={appearancePreferenceStore}>
      <ThemedApp />
    </AppThemeProvider>
  );
}

function ThemedApp() {
  const { scheme } = useAppTheme();
  return (
    <TrainingDataDeletionProvider>
      <StartupGate openDatabase={openApplicationDatabase}>
        <ActiveWorkoutVisibilityProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator />
        </ActiveWorkoutVisibilityProvider>
      </StartupGate>
    </TrainingDataDeletionProvider>
  );
}
