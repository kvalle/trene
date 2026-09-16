import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import { HomeScreen } from './screens/HomeScreen';
import { CreateExerciseScreen } from './screens/CreateExerciseScreen';
import { CompletedWorkoutScreen } from './screens/CompletedWorkoutScreen';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ExercisePickerScreen } from './screens/ExercisePickerScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DataScreen } from './screens/DataScreen';
import { DeleteTrainingDataScreen } from './screens/DeleteTrainingDataScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { useAppTheme } from './ui/AppThemeProvider';
import { getAppStackScreenOptions } from './ui/appShell';
import { WorkoutSetDraftProvider } from './workoutSetDrafts';
import { ActiveWorkoutVisibilityScreen } from './screens/ActiveWorkoutVisibilityScreen';
import { useActiveWorkoutVisibility } from './activeWorkoutVisibility/ActiveWorkoutVisibilityContext';

export type RootStackParamList = {
  Home: { focusStartWorkout?: boolean } | undefined;
  Workout: { focusExerciseId?: number; focusAddExercise?: boolean } | undefined;
  CompletedWorkout: { workoutId: number; fromCompletion?: boolean };
  History: { focusWorkoutId?: number; focusEmptyAction?: boolean } | undefined;
  Exercises: { focusExerciseId?: number; focusEmptyAction?: boolean } | undefined;
  ExercisePicker: { workoutId: number };
  CreateExercise: {
    initialName?: string;
    origin?: 'exercises' | 'workout';
    workoutId?: number;
  } | undefined;
  ExerciseDetail: { exerciseId: number };
  Settings: undefined;
  Appearance: undefined;
  ActiveWorkoutVisibility: undefined;
  Data: undefined;
  DeleteTrainingData: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const { colors, navigation: theme } = useAppTheme();
  const { consumeNavigationIntent, navigationIntent } = useActiveWorkoutVisibility();
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    if (!navigationIntent || !navigationRef.isReady()) return;
    navigationRef.reset({ index: navigationIntent === 'Workout' ? 1 : 0, routes: navigationIntent === 'Workout'
      ? [{ name: 'Home' }, { name: 'Workout' }]
      : [{ name: 'Home' }] });
    consumeNavigationIntent();
  }, [consumeNavigationIntent, navigationIntent, navigationReady]);

  return (
    <WorkoutSetDraftProvider>
      <NavigationContainer ref={navigationRef} theme={theme} onReady={() => setNavigationReady(true)}>
        <Stack.Navigator screenOptions={getAppStackScreenOptions(colors)}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Trene' }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: 'Treningsøkt' }} />
          <Stack.Screen name="CompletedWorkout" component={CompletedWorkoutScreen} options={{ title: 'Fullført trening' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Tidligere treninger' }} />
          <Stack.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Øvelser' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Innstillinger' }} />
          <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Utseende' }} />
          <Stack.Screen name="ActiveWorkoutVisibility" component={ActiveWorkoutVisibilityScreen} options={{ title: 'Notifikasjoner' }} />
          <Stack.Screen name="Data" component={DataScreen} options={{ title: 'Dine data' }} />
          <Stack.Screen name="DeleteTrainingData" component={DeleteTrainingDataScreen} options={{ title: 'Slett treningsdata' }} />
          <Stack.Screen
            name="ExercisePicker"
            component={ExercisePickerScreen}
            options={{ presentation: 'modal', title: 'Legg til øvelse' }}
          />
          <Stack.Screen
            name="CreateExercise"
            component={CreateExerciseScreen}
            options={{ presentation: 'modal', title: 'Ny øvelse' }}
          />
          <Stack.Screen
            name="ExerciseDetail"
            component={ExerciseDetailScreen}
            options={{ title: 'Øvelse' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WorkoutSetDraftProvider>
  );
}
