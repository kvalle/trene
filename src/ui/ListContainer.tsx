import { StyleSheet, View, type ViewProps } from 'react-native';

import { radii } from '../theme';
import { useAppTheme } from './AppThemeProvider';

export function ListContainer({ children, style, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      {...rest}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.container,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
