import { StyleSheet, Text, View, Pressable, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

export type SingleSelectionOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
  testID?: string;
};

type SingleSelectionGroupProps<Value extends string> = Omit<ViewProps, 'accessibilityLabel' | 'children'> & {
  accessibilityLabel: string;
  options: readonly SingleSelectionOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
};

export function SingleSelectionGroup<Value extends string>({
  accessibilityLabel,
  options,
  value,
  onValueChange,
  style,
  ...rest
}: SingleSelectionGroupProps<Value>) {
  const { colors } = useAppTheme();
  const selectedOptionCount = options.filter((option) => option.value === value).length;
  const optionValues = new Set(options.map((option) => option.value));

  if (optionValues.size !== options.length || selectedOptionCount !== 1) {
    throw new Error('SingleSelectionGroup requires unique options and exactly one option matching value.');
  }

  return (
    <View
      {...rest}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        const disabled = Boolean(option.disabled);

        return (
          <Pressable
            accessibilityHint={accessibilityLabel}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={disabled ? undefined : () => onValueChange(option.value)}
            testID={option.testID}
            style={({ pressed }) => [
              styles.option,
              index < options.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
              pressed && !disabled && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.radio, { borderColor: checked && !disabled ? colors.primary : colors.muted }]}
            >
              {checked ? <View style={[styles.radioDot, { backgroundColor: disabled ? colors.muted : colors.primary }]} /> : null}
            </View>
            <Text style={[typography.control, styles.label, { color: disabled ? colors.muted : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radii.container,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  label: { flex: 1 },
});
