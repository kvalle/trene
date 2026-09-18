import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';
import { Icon } from './Icon';

type DisclosureCardProps = ViewProps & {
  title: string;
  summary?: string;
  expanded: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  leading?: React.ReactNode;
  progress?: number;
  headerRef?: (node: View | null) => void;
  children?: React.ReactNode;
};

export function DisclosureCard({ title, summary, expanded, onPress, accessibilityLabel, leading, progress, headerRef, children, style, testID, ...rest }: DisclosureCardProps) {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const normalizedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress ?? 0)) : 0;
  const animatedProgress = useRef(new Animated.Value(normalizedProgress)).current;
  const motionPreferenceChanged = useRef(false);

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
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    }
    onPress();
  }

  return (
    <View {...rest} testID={testID} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={toggle}
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
          {summary ? <Text style={[typography.metadata, { color: progress === undefined ? colors.muted : colors.text }]}>{summary}</Text> : null}
        </View>
        <Icon color={colors.muted} name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
      </Pressable>
      {expanded ? <View style={[styles.content, { borderTopColor: colors.border }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.container, borderWidth: 1, overflow: 'hidden' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, padding: 16 },
  progress: { bottom: 0, left: 0, position: 'absolute', top: 0, transformOrigin: 'left', width: '100%' },
  copy: { flex: 1, gap: 4 },
  content: { borderTopWidth: 1, gap: 16, padding: 16 },
  pressed: { opacity: 0.72 },
});
