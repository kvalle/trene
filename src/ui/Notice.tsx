import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type NoticeProps = ViewProps & {
  title: string;
  message: string;
  testID?: string;
};

export function Notice({ title, message, testID, style, ...rest }: NoticeProps) {
  const { colors } = useAppTheme();
  return (
    <View {...rest} testID={testID} style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, style]}>
      <Text style={[typography.control, { color: colors.text }]} allowFontScaling>{title}</Text>
      <Text style={[typography.body, { color: colors.text }]} allowFontScaling>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radii.container, borderWidth: 1, gap: 8, padding: 16 },
});
