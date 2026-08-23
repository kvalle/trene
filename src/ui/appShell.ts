import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import type { SemanticColors } from '../theme';

export function getAppStackScreenOptions(colors: SemanticColors): NativeStackNavigationOptions {
  return {
    contentStyle: { backgroundColor: colors.background },
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
  };
}
