import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type SearchFieldProps = Omit<TextInputProps, 'accessibilityLabel' | 'placeholder'> & {
  label: string;
  placeholder?: string;
  testID?: string;
};

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { label, onBlur, onFocus, placeholder = 'Søk', style, testID, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      ref={ref}
      accessibilityLabel={label}
      autoCapitalize="none"
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      returnKeyType="search"
      testID={testID}
      style={[
        styles.input,
        typography.body,
        { backgroundColor: colors.surface, borderColor: focused ? colors.focus : colors.border, color: colors.text },
        style,
      ]}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
