import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { Badge } from './Badge';
import { Icon } from './Icon';

type CheckboxRowProps = Omit<PressableProps, 'children' | 'onPress'> & {
  title: string;
  /** Optional status label after the title, such as "Arkivert". */
  badge?: string;
  checked: boolean;
  /** Optional trailing count, shown as muted text. */
  count?: number | string;
  /** Checked and cannot be unchecked, e.g. the last remaining selection. */
  locked?: boolean;
  showSeparator?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  testID?: string;
};

export const CheckboxRow = forwardRef<ViewType, CheckboxRowProps>(function CheckboxRow(
  {
    title,
    badge,
    checked,
    count,
    locked = false,
    disabled,
    showSeparator = false,
    onCheckedChange,
    testID,
    accessibilityLabel,
    accessibilityState,
    style,
    ...rest
  },
  ref,
) {
  const { colors } = useAppTheme();
  const isChecked = checked || locked;
  const isDisabled = Boolean(disabled || locked);
  const hasCount = count !== undefined && count !== '';
  const boxColor = isDisabled ? colors.muted : colors.primary;

  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? [title, badge, hasCount ? count : undefined].filter((part) => part !== undefined && part !== '').join(', ')}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, disabled: isDisabled, ...accessibilityState }}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : () => onCheckedChange?.(!isChecked)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        showSeparator && { borderBottomColor: colors.border, borderBottomWidth: 1 },
        pressed && !isDisabled && { backgroundColor: colors.surfaceAlt },
        style as object,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={testID ? `${testID}-box` : undefined}
        style={[
          styles.box,
          isChecked
            ? { backgroundColor: boxColor, borderColor: boxColor }
            : { borderColor: colors.muted },
        ]}
      >
        {isChecked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
      </View>
      <View style={styles.label}>
        <Text style={[typography.control, styles.title, { color: isDisabled ? colors.muted : colors.text }]}>{title}</Text>
        {badge ? <Badge label={badge} testID={testID ? `${testID}-badge` : undefined} /> : null}
      </View>
      {hasCount ? (
        <Text style={[typography.metadata, { color: colors.muted }]} testID={testID ? `${testID}-count` : undefined}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  box: {
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  label: { alignItems: 'center', flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { flexShrink: 1 },
});
