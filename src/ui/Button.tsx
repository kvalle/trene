import { forwardRef, useState } from 'react';
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
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

type SharedButtonProps = Omit<PressableProps, 'accessibilityLabel' | 'children'> & {
  accessibilityLabel?: string;
  busy?: boolean;
  testID?: string;
};

type LabelledButtonProps = SharedButtonProps & {
  title: string;
  variant?: ButtonVariant;
  icon?: never;
};

type IconOnlyButtonProps = SharedButtonProps & {
  accessibilityLabel: string;
  icon: IconName;
  title?: never;
  variant?: Extract<ButtonVariant, 'primary' | 'secondary'>;
};

export type ButtonProps = LabelledButtonProps | IconOnlyButtonProps;

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    title,
    icon,
    variant = 'primary',
    disabled,
    busy,
    testID,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    onPress,
    onBlur,
    onFocus,
    style,
    ...rest
  },
  ref,
) {
  const { colors, scheme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const isDisabled = Boolean(disabled || busy);
  const isIconOnly = icon !== undefined;
  const pressedOpacity = 0.72;

  if (isIconOnly && !accessibilityLabel.trim()) {
    throw new Error('Icon-only Button requires a non-empty accessibilityLabel.');
  }

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

  const contentColor = (() => {
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
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
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
        focused && !isDisabled && [styles.focused, { outlineColor: colors.focus }],
        pressed && !isDisabled && { opacity: pressedOpacity },
        style as object,
        isIconOnly && styles.iconOnly,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={contentColor}
          size="small"
          style={styles.spinner}
          testID={testID ? `${testID}-busy` : undefined}
        />
      ) : null}
      {!busy && icon ? (
        <Icon color={contentColor} name={icon} size={24} testID={testID ? `${testID}-icon` : undefined} />
      ) : null}
      {title ? (
        <Text
          style={[
            typography.control,
            { color: contentColor, textAlign: 'center' },
            busy && { opacity: 0.95 },
          ]}
          allowFontScaling
          maxFontSizeMultiplier={2}
        >
          {title}
        </Text>
      ) : null}
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
  focused: {
    outlineStyle: 'solid',
    outlineWidth: 3,
  },
  iconOnly: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: 48,
  },
});
