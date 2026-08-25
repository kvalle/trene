import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type SelectionRowProps = Omit<PressableProps, 'children'> & {
  title: string;
  busy?: boolean;
  showSeparator?: boolean;
  testID?: string;
};

export const SelectionRow = forwardRef<ViewType, SelectionRowProps>(function SelectionRow(
  { title, busy = false, disabled, showSeparator = false, testID, accessibilityLabel, accessibilityState, style, onPress, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const isDisabled = Boolean(disabled || busy);
  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy, ...accessibilityState }}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        showSeparator && { borderBottomColor: colors.border, borderBottomWidth: 1 },
        pressed && !isDisabled && styles.pressed,
        style as object,
      ]}
    >
      <Text style={[typography.control, styles.title, { color: isDisabled ? colors.muted : colors.text }]}>{title}</Text>
      {busy ? <ActivityIndicator accessibilityLabel="Legger til" color={colors.primary} size="small" testID={testID ? `${testID}-busy` : undefined} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.72 },
});
