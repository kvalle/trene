import { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { Button } from './Button';

type ErrorAlertProps = ViewProps & {
  message: string;
  title?: string;
  secondaryMessage?: string;
  actionTitle?: string;
  onAction?: () => void;
  actionTestID?: string;
  testID?: string;
};

export const ErrorAlert = forwardRef<View, ErrorAlertProps>(function ErrorAlert(
  { message, title, secondaryMessage, actionTitle, onAction, actionTestID, testID, style, ...rest },
  ref,
) {
  const { colors, scheme } = useAppTheme();
  const backgroundColor = scheme === 'dark' ? 'rgba(255,180,170,0.14)' : 'rgba(164,63,54,0.10)';
  const borderColor = colors.danger;

  return (
    <View
      {...rest}
      ref={ref}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.container, { backgroundColor, borderColor }, style as object]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.danger }]}>
          <Text style={[styles.iconText, { color: colors.onDanger }]} allowFontScaling>
            !
          </Text>
        </View>
        <View style={styles.textGroup}>
          {title ? (
            <Text style={[typography.control, { color: colors.text }]} allowFontScaling>
              {title}
            </Text>
          ) : null}
          <Text style={[typography.body, { color: colors.text }]} allowFontScaling>
            {message}
          </Text>
          {secondaryMessage ? (
            <Text style={[typography.metadata, { color: colors.muted }]} allowFontScaling>
              {secondaryMessage}
            </Text>
          ) : null}
        </View>
      </View>
      {actionTitle && onAction ? (
        <Button title={actionTitle} variant="secondary" onPress={onAction} testID={actionTestID} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.container,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  iconText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 4,
  },
});
