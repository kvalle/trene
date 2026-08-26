import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type View as ViewType } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type CompactActionProps = Omit<PressableProps, 'children'> & {
  icon: string;
  label: string;
  busy?: boolean;
};

export const CompactAction = forwardRef<ViewType, CompactActionProps>(function CompactAction({ icon, label, accessibilityLabel, busy, disabled, style, ...rest }, ref) {
  const { colors } = useAppTheme();
  const isDisabled = Boolean(disabled || busy);
  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: Boolean(busy), disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.action, pressed && !isDisabled && styles.pressed, isDisabled && styles.disabled, style as object]}
    >
      <View accessible={false} style={styles.content}>
        {busy ? <ActivityIndicator color={colors.text} size="small" /> : <Text accessible={false} style={[styles.icon, { color: colors.text }]}>{icon}</Text>}
        <Text style={[typography.metadata, styles.label, { color: colors.text }]}>{label}</Text>
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
  disabled: { opacity: 0.55 },
});
