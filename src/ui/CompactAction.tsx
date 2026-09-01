import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type CompactActionProps = Omit<PressableProps, 'children'> & {
  icon: string;
  label: string;
  busy?: boolean;
  tone?: 'accent' | 'neutral';
};

export const CompactAction = forwardRef<ViewType, CompactActionProps>(function CompactAction({ icon, label, accessibilityLabel, busy, disabled, style, tone = 'accent', ...rest }, ref) {
  const { colors } = useAppTheme();
  const isDisabled = Boolean(disabled || busy);
  const color = isDisabled ? colors.muted : tone === 'accent' ? colors.primary : colors.text;
  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: Boolean(busy), disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.action,
        state.pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View accessible={false} style={styles.content}>
        {busy ? <ActivityIndicator color={color} size="small" /> : <Text accessible={false} style={[styles.icon, { color }]}>{icon}</Text>}
        <Text style={[typography.metadata, styles.label, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  action: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 48, paddingHorizontal: 4, paddingVertical: 8 },
  content: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  icon: { fontSize: 18, lineHeight: 20 },
  label: { fontWeight: '700' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 1 },
});
