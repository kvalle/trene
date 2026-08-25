import { forwardRef } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { Button } from './Button';
import { Loader } from './Loader';

type PageStatusProps = ViewProps & {
  variant: 'loading' | 'error' | 'empty' | 'no-results' | 'missing' | 'safe-stop';
  title?: string;
  message?: string;
  secondaryMessage?: string;
  loaderLabel?: string;
  actionTitle?: string;
  onAction?: () => void;
  actionTestID?: string;
  actionRef?: React.RefObject<View | null>;
  testID?: string;
};

export const PageStatus = forwardRef<View, PageStatusProps>(function PageStatus(
  { variant, title, message, secondaryMessage, loaderLabel, actionTitle, onAction, actionTestID, actionRef, testID, style, ...rest },
  ref,
) {
  const { colors } = useAppTheme();

  const isLoading = variant === 'loading';
  const isError = variant === 'error' || variant === 'safe-stop';
  const showIcon = isError;

  return (
    <View
      {...rest}
      ref={ref}
      testID={testID}
      accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
      style={[styles.container, style as object]}
    >
      <View style={styles.content}>
        {isLoading ? (
          <Loader label={loaderLabel} size="large" testID={testID ? `${testID}-loader` : undefined} />
        ) : showIcon ? (
          <View style={[styles.icon, { backgroundColor: colors.danger }]}>
            <Text style={[styles.iconText, { color: colors.onDanger }]} allowFontScaling>
              !
            </Text>
          </View>
        ) : null}
        {title ? (
          <Text
            accessibilityRole="header"
            style={[typography.sectionTitle, { color: colors.text, textAlign: 'center' }]}
            allowFontScaling
          >
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text accessibilityRole={isError ? 'alert' : undefined} style={[typography.body, { color: colors.text, textAlign: 'center' }]} allowFontScaling>
            {message}
          </Text>
        ) : null}
        {secondaryMessage ? (
          <Text style={[typography.metadata, { color: colors.muted, textAlign: 'center' }]} allowFontScaling>
            {secondaryMessage}
          </Text>
        ) : null}
        {actionTitle && onAction && variant !== 'safe-stop' ? (
          <View style={styles.action}>
            <Button ref={actionRef} title={actionTitle} variant="primary" onPress={onAction} testID={actionTestID} />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 440,
    width: '100%',
  },
  icon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  action: {
    marginTop: 8,
    minWidth: 160,
  },
});
