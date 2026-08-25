import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type DataRowProps = ViewProps & {
  label: string;
  value: string;
  accessibilityLabel?: string;
  showSeparator?: boolean;
};

export function DataRow({ label, value, accessibilityLabel, showSeparator = false, style, ...rest }: DataRowProps) {
  const { colors } = useAppTheme();
  return (
    <View
      {...rest}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
      style={[styles.row, showSeparator && { borderTopColor: colors.border, borderTopWidth: 1 }, style]}
    >
      <Text style={[typography.control, { color: colors.text }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingTop: 12 },
});
