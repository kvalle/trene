import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type HeroProps = ViewProps & {
  title: string;
  description?: string;
  testID?: string;
};

export function Hero({ title, description, testID, children, style, ...rest }: HeroProps) {
  const { colors } = useAppTheme();
  return (
    <View testID={testID} style={[styles.container, style as object]} {...rest}>
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]} allowFontScaling>
        {title}
      </Text>
      {description ? (
        <Text style={[typography.body, { color: colors.text }]} allowFontScaling>
          {description}
        </Text>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingTop: 8,
  },
  actions: {
    gap: 12,
    marginTop: 28,
  },
});
