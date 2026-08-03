import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './AppNavigator';
import { openApplicationDatabase } from './database/openDatabase';
import { StartupGate } from './StartupGate';

export default function App() {
  return (
    <StartupGate openDatabase={openApplicationDatabase}>
      <StatusBar style="auto" />
      <AppNavigator />
    </StartupGate>
  );
}
