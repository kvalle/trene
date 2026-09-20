import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { Icon } from './Icon';

type DisclosureCardProps = ViewProps & {
  title: string;
  summary?: string;
  summaryEmphasized?: boolean;
  expanded: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  leading?: React.ReactNode;
  progress?: number;
  headerRef?: (node: View | null) => void;
  reorderEnabled?: boolean;
  reordering?: boolean;
  onReorderStart?: () => boolean;
  onReorderMove?: (pageY: number) => void;
  onReorderEnd?: () => void;
  onReorderCancel?: () => void;
  children?: React.ReactNode;
};

export function DisclosureCard({ title, summary, summaryEmphasized = false, expanded, onPress, accessibilityLabel, accessibilityActions, onAccessibilityAction, leading, progress, headerRef, reorderEnabled = false, reordering = false, onReorderStart, onReorderMove, onReorderEnd, onReorderCancel, children, style, testID, ...rest }: DisclosureCardProps) {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const normalizedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress ?? 0)) : 0;
  const animatedProgress = useRef(new Animated.Value(normalizedProgress)).current;
  const motionPreferenceChanged = useRef(false);
  const longPressStarted = useRef(false);
  const suppressPress = useRef(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !motionPreferenceChanged.current) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      motionPreferenceChanged.current = true;
      setReduceMotion(enabled);
    });
    return () => {
      active = false;
      animatedProgress.stopAnimation();
      subscription.remove();
    };
  }, [animatedProgress]);

  useEffect(() => {
    animatedProgress.stopAnimation();
    if (reduceMotion) {
      animatedProgress.setValue(normalizedProgress);
      return;
    }
    Animated.timing(animatedProgress, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      toValue: normalizedProgress,
      useNativeDriver: true,
    }).start();
  }, [animatedProgress, normalizedProgress, reduceMotion]);

  function toggle() {
    if (suppressPress.current) {
      suppressPress.current = false;
      return;
    }
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    }
    onPress();
  }

  function move(event: GestureResponderEvent) {
    if (longPressStarted.current) onReorderMove?.(event.nativeEvent.pageY);
  }

  function end() {
    if (!longPressStarted.current) return;
    longPressStarted.current = false;
    suppressPress.current = true;
    onReorderEnd?.();
    setTimeout(() => { suppressPress.current = false; }, 250);
  }

  function cancel() {
    if (!longPressStarted.current) return;
    longPressStarted.current = false;
    onReorderCancel?.();
  }

  return (
    <View {...rest} testID={testID} style={[
      styles.card,
      { backgroundColor: reordering ? colors.secondary : colors.surface, borderColor: reordering ? colors.primary : colors.border },
      reordering && styles.reordering,
      style,
    ]}>
      <Pressable
        accessibilityActions={accessibilityActions}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onAccessibilityAction={onAccessibilityAction}
        delayLongPress={420}
        onLongPress={reorderEnabled ? () => {
          longPressStarted.current = onReorderStart?.() !== false;
        } : undefined}
        onPress={toggle}
        onPressOut={end}
        onTouchCancel={cancel}
        onTouchMove={move}
        ref={headerRef}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        {progress !== undefined ? (
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={testID ? `${testID}-progress` : undefined}
            style={[
              styles.progress,
              { backgroundColor: colors.secondary, transform: [{ scaleX: animatedProgress }] },
            ]}
          />
        ) : null}
        {leading}
        <View style={styles.copy}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
          {summary ? <Text style={[
            typography.metadata,
            { color: summaryEmphasized ? colors.primary : progress === undefined ? colors.muted : colors.text },
            summaryEmphasized && styles.emphasizedSummary,
          ]}>{summary}</Text> : null}
        </View>
        <Icon color={colors.muted} name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
      </Pressable>
      {expanded ? <View style={[styles.content, { borderTopColor: colors.border }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.container, borderWidth: 1, overflow: 'hidden' },
  reordering: { borderLeftWidth: 4 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, padding: 16 },
  progress: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, transformOrigin: 'left' },
  copy: { flex: 1, gap: 4 },
  content: { borderTopWidth: 1, gap: 16, padding: 16 },
  emphasizedSummary: { fontStyle: 'italic' },
  pressed: { opacity: 0.72 },
});
