import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { HomeScreen } from './screens/HomeScreen';
import { CreateExerciseScreen } from './screens/CreateExerciseScreen';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { darkTheme, lightTheme } from './theme';

export type RootStackParamList = {
  Home: undefined;
  Workout: undefined;
  History: undefined;
  Exercises: undefined;
  CreateExercise: { initialName?: string } | undefined;
  ExerciseDetail: { exerciseId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Trene' }} />
        <Stack.Screen name="Workout" options={{ title: 'Treningsøkt' }}>
          {() => <PlaceholderScreen title="Treningsøkt" />}
        </Stack.Screen>
        <Stack.Screen name="History" options={{ title: 'Tidligere økter' }}>
          {() => <PlaceholderScreen title="Tidligere økter" />}
        </Stack.Screen>
        <Stack.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Øvelser' }} />
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
  );
}
