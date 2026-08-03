import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';

import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { darkTheme, lightTheme } from './theme';

export type RootStackParamList = {
  Home: undefined;
  Workout: undefined;
  History: undefined;
  Exercises: undefined;
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
        <Stack.Screen name="Exercises" options={{ title: 'Øvelser' }}>
          {() => <PlaceholderScreen title="Øvelser" />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
