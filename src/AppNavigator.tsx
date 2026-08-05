import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { HomeScreen } from './screens/HomeScreen';
import { CreateExerciseScreen } from './screens/CreateExerciseScreen';
import { CompletedWorkoutScreen } from './screens/CompletedWorkoutScreen';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { ExercisePickerScreen } from './screens/ExercisePickerScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { darkTheme, lightTheme } from './theme';
import { WorkoutDraftProvider } from './workoutDrafts';

export type RootStackParamList = {
  Home: { focusStartWorkout?: boolean } | undefined;
  Workout: { focusExerciseId?: number; focusAddExercise?: boolean } | undefined;
  CompletedWorkout: { workoutId: number; fromCompletion?: boolean };
  History: undefined;
  Exercises: undefined;
  ExercisePicker: { workoutId: number };
  CreateExercise: {
    initialName?: string;
    origin?: 'exercises' | 'workout';
    workoutId?: number;
  } | undefined;
  ExerciseDetail: { exerciseId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <WorkoutDraftProvider>
      <NavigationContainer theme={theme}>
        <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Trene' }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: 'Treningsøkt' }} />
          <Stack.Screen name="CompletedWorkout" component={CompletedWorkoutScreen} options={{ title: 'Fullført økt' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Tidligere økter' }} />
          <Stack.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Øvelser' }} />
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
