import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type View,
} from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  busy?: boolean;
  testID?: string;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    title,
    variant = 'primary',
    disabled,
    busy,
    testID,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    onPress,
    style,
    ...rest
  },
  ref,
) {
  const { colors, scheme } = useAppTheme();
  const isDisabled = Boolean(disabled || busy);
  const pressedOpacity = 0.72;

  const backgroundColor = (() => {
    if (isDisabled) {
      if (variant === 'primary' || variant === 'destructive') {
        // neutral disabled fill approximating color-mix(muted 24%, bg) and muted 72% text
        // Use border as disabled surface for simplicity, meets neutral requirement
        return scheme === 'dark' ? '#24332b' : '#e2e8e2';
      }
      if (variant === 'secondary') return colors.surface;
      return 'transparent';
    }
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.surface;
      case 'destructive':
        return colors.danger;
      case 'text':
      default:
        return 'transparent';
    }
  })();

  const textColor = (() => {
    if (isDisabled) {
      // de-emphasized muted text so disabled does not read as hierarchy
      return colors.muted;
    }
    switch (variant) {
      case 'primary':
        return colors.onPrimary;
      case 'secondary':
        return colors.text;
      case 'destructive':
        return colors.onDanger;
      case 'text':
      default:
        return colors.text;
    }
  })();

  const borderColor = (() => {
    if (variant === 'secondary') {
      return colors.border;
    }
    if ((variant === 'primary' || variant === 'destructive') && isDisabled) return 'transparent';
    return 'transparent';
  })();

  const borderWidth = variant === 'secondary' ? 1 : 0;

  return (
    <Pressable
      {...rest}
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(busy), ...accessibilityState }}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : borderWidth,
        },
        isDisabled && variant === 'secondary' && { opacity: 1 },
        pressed && !isDisabled && { opacity: pressedOpacity },
        style as object,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={textColor}
          size="small"
          style={styles.spinner}
          testID={testID ? `${testID}-busy` : undefined}
        />
      ) : null}
      <Text
        style={[
          typography.control,
          { color: textColor, textAlign: 'center' },
          busy && { opacity: 0.95 },
        ]}
        allowFontScaling
        maxFontSizeMultiplier={2}
      >
        {title}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  spinner: {
    marginRight: 2,
  },
});
