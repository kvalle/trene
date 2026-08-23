import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import { useAppTheme } from './ui/AppThemeProvider';
import { getAppStackScreenOptions } from './ui/appShell';
import { WorkoutDraftProvider } from './workoutDrafts';

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
  Data: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { colors, navigation: theme } = useAppTheme();

  return (
    <WorkoutDraftProvider>
      <NavigationContainer theme={theme}>
        <Stack.Navigator screenOptions={getAppStackScreenOptions(colors)}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Trene' }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: 'Treningsøkt' }} />
          <Stack.Screen name="CompletedWorkout" component={CompletedWorkoutScreen} options={{ title: 'Fullført økt' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Tidligere økter' }} />
          <Stack.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Øvelser' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Innstillinger' }} />
          <Stack.Screen name="Data" component={DataScreen} options={{ title: 'Data' }} />
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
    </WorkoutDraftProvider>
  );
}
