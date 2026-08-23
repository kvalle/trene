import { render, screen } from '@testing-library/react-native';
import { AppNavigator } from '../AppNavigator';
import { darkTheme, lightTheme } from '../theme';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children, theme }: { children: React.ReactNode; theme: { dark: boolean } }) => {
    const { View } = require('react-native');
    return (
      <View testID="navigation-container" accessibilityValue={{ text: theme.dark ? 'dark' : 'light' }}>
        {children}
      </View>
    );
  },
  DarkTheme: { dark: true, colors: {} },
  DefaultTheme: { dark: false, colors: {} },
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children, screenOptions }: { children: React.ReactNode; screenOptions: object }) => {
      const { View } = require('react-native');
      return (
        <View testID="stack" accessibilityValue={{ text: JSON.stringify(screenOptions) }}>
          {children}
        </View>
      );
    },
    Screen: ({ name, options }: { name: string; options?: object }) => {
      const { Text } = require('react-native');
      return <Text testID="route">{JSON.stringify({ name, options })}</Text>;
    },
  }),
}));

jest.mock('../workoutDrafts', () => ({
  WorkoutDraftProvider: ({ children }: { children: React.ReactNode }) => (
    require('react').createElement(require('react-native').View, { testID: 'workout-draft-provider' }, children)
  ),
}));

jest.mock('../ui/AppThemeProvider', () => ({
  useAppTheme: () => {
    const theme = mockColorScheme === 'dark' ? require('../theme').darkTheme : require('../theme').lightTheme;
    return {
      colors: mockColorScheme === 'dark' ? require('../theme').darkColors : require('../theme').lightColors,
      navigation: theme,
      scheme: mockColorScheme,
    };
  },
}));

describe('AppNavigator', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('applies the %s app theme to navigation', (scheme, expectedTheme) => {
    mockColorScheme = scheme;
    render(<AppNavigator />);

    expect(screen.getByTestId('navigation-container')).toHaveAccessibilityValue(
      { text: expectedTheme === darkTheme ? 'dark' : 'light' },
    );
  });

  it('preserves the native stack and workout draft boundary', () => {
    render(<AppNavigator />);

    expect(screen.getByTestId('workout-draft-provider')).toContainElement(
      screen.getByTestId('navigation-container'),
    );
    expect(screen.getByTestId('stack')).toHaveAccessibilityValue(
      { text: JSON.stringify({
        contentStyle: { backgroundColor: lightTheme.colors.background },
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: lightTheme.colors.card },
        headerTintColor: lightTheme.colors.text,
      }) },
    );
    expect(screen.getAllByTestId('route').map((route) => JSON.parse(String(route.props.children)))).toEqual([
      { name: 'Home', options: { title: 'Trene' } },
      { name: 'Workout', options: { title: 'Treningsøkt' } },
      { name: 'CompletedWorkout', options: { title: 'Fullført økt' } },
      { name: 'History', options: { title: 'Tidligere økter' } },
      { name: 'Exercises', options: { title: 'Øvelser' } },
      { name: 'Settings', options: { title: 'Innstillinger' } },
      { name: 'Data', options: { title: 'Data' } },
      { name: 'ExercisePicker', options: { presentation: 'modal', title: 'Legg til øvelse' } },
      { name: 'CreateExercise', options: { presentation: 'modal', title: 'Ny øvelse' } },
      { name: 'ExerciseDetail', options: { title: 'Øvelse' } },
    ]);
  });
});
