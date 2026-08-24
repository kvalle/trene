import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type LoaderProps = {
  label?: string;
  size?: 'large' | 'compact';
  testID?: string;
};

export function Loader({ label, size = 'large', testID }: LoaderProps) {
  const { colors } = useAppTheme();
  const indicatorSize = size === 'large' ? 'large' : 'small';
  const accessibilityLabel = label ?? (size === 'large' ? 'Laster' : undefined);

  if (size === 'compact') {
    return (
      <View
        testID={testID}
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
        style={styles.compact}
      >
        <ActivityIndicator color={colors.primary} size={indicatorSize} />
        {label ? (
          <Text style={[typography.metadata, { color: colors.muted }]} allowFontScaling>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={styles.large}
    >
      <ActivityIndicator color={colors.primary} size={indicatorSize} testID={testID ? `${testID}-indicator` : undefined} />
      {label ? (
        <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]} allowFontScaling>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  compact: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
});
