import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        Klar for en økt?
      </Text>
      <Text style={[styles.introduction, { color: colors.text }]}>
        Registrer øvelser og sett mens du trener.
      </Text>
      <View style={styles.actions}>
        <Action colors={colors} label="Start økt" onPress={() => navigation.navigate('Workout')} primary />
        <Action colors={colors} label="Tidligere økter" onPress={() => navigation.navigate('History')} />
        <Action colors={colors} label="Øvelser" onPress={() => navigation.navigate('Exercises')} />
      </View>
    </ScrollView>
  );
}

function Action({
  colors,
  label,
  onPress,
  primary = false,
}: {
  colors: { background: string; border: string; primary: string; text: string };
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { borderColor: primary ? colors.primary : colors.border },
        primary && { backgroundColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
  },
  introduction: {
    fontSize: 18,
    lineHeight: 27,
    marginTop: 12,
  },
  actions: {
    gap: 12,
    marginTop: 40,
  },
  action: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
