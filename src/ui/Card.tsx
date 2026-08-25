import { StyleSheet, View, type ViewProps } from 'react-native';

import { radii } from '../theme';
import { useAppTheme } from './AppThemeProvider';

export function Card({ children, style, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View {...rest} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.container, borderWidth: 1, gap: 12, padding: 16 },
});
