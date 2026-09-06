import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

const DEFAULT_DURATION_MS = 5000;

type PositiveStatusProps = Omit<ViewProps, 'children'> & {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  testID?: string;
};

export function PositiveStatus({
  message,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
  testID,
  style,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  ...rest
}: PositiveStatusProps) {
  const { colors, scheme } = useAppTheme();
  const progress = useRef(new Animated.Value(1)).current;
  const remainingMs = useRef(durationMs);
  const startedAt = useRef<number | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissed = useRef(false);
  const mounted = useRef(true);
  const onDismissRef = useRef(onDismiss);
  const interactions = useRef(new Set<string>());
  const reduceMotion = useRef(true);

  onDismissRef.current = onDismiss;

  function stopTimer() {
    animation.current?.stop();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
  }

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    stopTimer();
    onDismissRef.current();
  }

  function startTimer() {
    if (dismissed.current || remainingMs.current <= 0 || interactions.current.size > 0) return;
    startedAt.current = Date.now();
    dismissTimer.current = setTimeout(dismiss, remainingMs.current);
    if (!reduceMotion.current) {
      animation.current = Animated.timing(progress, {
        duration: remainingMs.current,
        toValue: 0,
        useNativeDriver: true,
      });
      animation.current.start();
    }
  }

  function pauseTimer() {
    if (startedAt.current === null) return;
    stopTimer();
    remainingMs.current = Math.max(0, remainingMs.current - (Date.now() - startedAt.current));
    startedAt.current = null;
    progress.stopAnimation();
  }

  function beginInteraction(kind: string) {
    if (interactions.current.size === 0) pauseTimer();
    interactions.current.add(kind);
  }

  function endInteraction(kind: string) {
    interactions.current.delete(kind);
    if (interactions.current.size === 0) startTimer();
  }

  function updateMotionPreference(enabled: boolean) {
    if (!mounted.current) return;
    reduceMotion.current = enabled;
    animation.current?.stop();
    if (enabled || dismissed.current || startedAt.current === null) {
      progress.setValue(1);
      return;
    }
    const activeRemainingMs = Math.max(0, remainingMs.current - (Date.now() - startedAt.current));
    progress.setValue(activeRemainingMs / durationMs);
    animation.current = Animated.timing(progress, {
      duration: activeRemainingMs,
      toValue: 0,
      useNativeDriver: true,
    });
    animation.current.start();
  }

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(updateMotionPreference);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateMotionPreference);
    return () => {
      mounted.current = false;
      subscription.remove();
    };
    // Motion preference only controls the decorative progress animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dismissed.current = false;
    remainingMs.current = durationMs;
    progress.setValue(1);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
    startTimer();
    return stopTimer;
    // startTimer only reads refs; motion preference changes do not restart this lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, message, progress]);

  const backgroundColor = scheme === 'dark' ? 'rgba(128,201,162,0.14)' : colors.surfaceAlt;

  return (
    <View
      {...rest}
      testID={testID}
      onTouchStart={(event) => {
        beginInteraction('touch');
        onTouchStart?.(event);
      }}
      onTouchEnd={(event) => {
        endInteraction('touch');
        onTouchEnd?.(event);
      }}
      onTouchCancel={(event) => {
        endInteraction('touch');
        onTouchCancel?.(event);
      }}
      onPointerEnter={() => beginInteraction('pointer')}
      onPointerLeave={() => endInteraction('pointer')}
      style={[styles.container, { backgroundColor, borderColor: colors.primary }, style as object]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary }]} accessibilityElementsHidden>
        <Text style={[styles.iconText, { color: colors.onPrimary }]} allowFontScaling={false}>
          ✓
        </Text>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[typography.body, styles.message, { color: colors.text }]}
        allowFontScaling
        maxFontSizeMultiplier={2}
      >
        {message}
      </Text>
      <Pressable
        accessibilityLabel="Lukk statusmelding"
        accessibilityRole="button"
        hitSlop={4}
        onFocus={() => beginInteraction('focus')}
        onBlur={() => endInteraction('focus')}
        onPress={dismiss}
        style={({ pressed }) => [styles.dismiss, pressed && { opacity: 0.72 }]}
        testID={testID ? `${testID}-dismiss` : undefined}
      >
        <Text style={[styles.dismissText, { color: colors.text }]} allowFontScaling={false}>
          ×
        </Text>
      </Pressable>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]} accessibilityElementsHidden>
        <Animated.View
          testID={testID ? `${testID}-progress` : undefined}
          style={[
            styles.progress,
            { backgroundColor: colors.primary, transform: [{ scaleX: progress }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    borderRadius: radii.container,
    borderWidth: 1,
    bottom: 16,
    elevation: 6,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    overflow: 'hidden',
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 13,
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    zIndex: 10,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  iconText: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  message: {
    flex: 1,
  },
  dismiss: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginTop: -12,
    width: 48,
  },
  dismissText: {
    fontSize: 28,
    lineHeight: 32,
  },
  progressTrack: {
    bottom: 0,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  progress: {
    height: '100%',
    transformOrigin: 'left',
    width: '100%',
  },
});
