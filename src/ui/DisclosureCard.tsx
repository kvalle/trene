import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { radii, typography } from '../theme';
import { useAppTheme } from './AppThemeProvider';

type DisclosureCardProps = ViewProps & {
  title: string;
  summary?: string;
  expanded: boolean;
  onPress: () => void;
  headerRef?: (node: View | null) => void;
  children?: React.ReactNode;
};

export function DisclosureCard({ title, summary, expanded, onPress, headerRef, children, style, ...rest }: DisclosureCardProps) {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  function toggle() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    }
    onPress();
  }

  return (
    <View {...rest} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={toggle}
        ref={headerRef}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
          {summary ? <Text style={[typography.metadata, { color: colors.muted }]}>{summary}</Text> : null}
        </View>
        <Text accessibilityElementsHidden style={[styles.indicator, { color: colors.muted }]}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? <View style={[styles.content, { borderTopColor: colors.border }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.container, borderWidth: 1, overflow: 'hidden' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56, padding: 16 },
  copy: { flex: 1, gap: 4 },
  indicator: { fontSize: 24, lineHeight: 28 },
  content: { borderTopWidth: 1, gap: 16, padding: 16 },
  pressed: { opacity: 0.72 },
});
