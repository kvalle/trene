import { StyleSheet, Text } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type Props = {
  message: string;
  testID?: string;
};

export function FieldError({ message, testID }: Props) {
  const { colors } = useAppTheme();
  return (
    <Text
      testID={testID}
      accessibilityRole="alert"
      style={[typography.metadata, styles.error, { color: colors.danger }]}
      allowFontScaling
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: 2,
  },
});
