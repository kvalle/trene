import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type NavigationRowProps = Omit<PressableProps, 'children'> & {
  title: string;
  description?: string;
  metadata?: string;
  showSeparator?: boolean;
  testID?: string;
};

export const NavigationRow = forwardRef<ViewType, NavigationRowProps>(function NavigationRow(
  { title, description, metadata, showSeparator = false, testID, accessibilityLabel, style, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? [title, description, metadata].filter(Boolean).join(', ')}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [styles.row, showSeparator && { borderBottomColor: colors.border, borderBottomWidth: 1 }, pressed && styles.pressed, style as object]}
    >
      <View style={styles.copy}>
        <Text style={[typography.control, { color: colors.text }]}>{title}</Text>
        {description ? <Text style={[typography.metadata, { color: colors.muted }]}>{description}</Text> : null}
      </View>
      {metadata ? <Text style={[typography.metadata, styles.metadata, { color: colors.muted }]}>{metadata}</Text> : null}
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.chevron, { color: colors.muted }]}>
        ›
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  copy: { flex: 1, gap: 4, paddingRight: 12 },
  metadata: { paddingRight: 8 },
  chevron: { fontSize: 22, fontWeight: '400' },
  pressed: { opacity: 0.72 },
});
