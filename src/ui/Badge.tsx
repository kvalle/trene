import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type BadgeProps = Omit<ViewProps, 'children'> & {
  label: string;
  testID?: string;
};

/**
 * Small, non-interactive status label shown next to a title, such as
 * "Arkivert". The label is read as ordinary text by assistive technologies.
 */
export function Badge({ label, testID, style, ...rest }: BadgeProps) {
  const { colors } = useAppTheme();
  return (
    <View
      {...rest}
      testID={testID}
      style={[styles.badge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}
    >
      <Text style={[styles.label, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  label: { ...typography.metadata, fontWeight: '700' },
});
