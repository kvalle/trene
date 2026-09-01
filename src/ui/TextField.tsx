import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { FieldError } from './FieldError';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  errorID?: string;
  containerStyle?: object;
  inputStyle?: object;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    errorID,
    testID,
    accessibilityLabel,
    accessibilityHint,
    editable,
    onFocus,
    onBlur,
    style,
    containerStyle,
    inputStyle,
    ...rest
  },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const isDisabled = editable === false;
  const hasError = Boolean(error);

  const borderColor = hasError
    ? colors.danger
    : focused
      ? colors.focus
      : colors.border;

  const derivedAccessibilityLabel = accessibilityLabel ?? (hasError ? `${label}. Feil: ${error}` : label);
  const derivedAccessibilityHint = accessibilityHint ?? (hasError ? 'Rett navnet og prøv igjen' : undefined);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        nativeID={`${testID ?? label}-label`}
        style={[typography.metadata, styles.label, { color: colors.text }]}
        allowFontScaling
      >
        {label}
      </Text>
      <TextInput
        {...rest}
        ref={ref}
        testID={testID}
        accessibilityLabel={derivedAccessibilityLabel}
        accessibilityHint={derivedAccessibilityHint}
        accessibilityState={{ disabled: isDisabled }}
        editable={!isDisabled}
        style={[
          styles.input,
          typography.body,
          {
            backgroundColor: colors.surface,
            borderColor,
            color: colors.text,
            opacity: isDisabled ? 0.6 : 1,
          },
          hasError && { borderColor: colors.danger },
          inputStyle,
          style as object,
        ]}
        placeholderTextColor={colors.muted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {hasError ? <FieldError message={error!} nativeID={errorID} testID={testID ? `${testID}-error` : undefined} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
