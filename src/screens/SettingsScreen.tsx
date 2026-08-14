import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Innstillinger</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Data')}
        style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
      >
        <Text style={[styles.rowTitle, { color: colors.text }]}>Data</Text>
        <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  heading: { fontSize: 30, fontWeight: '700', marginBottom: 28 },
  row: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 18 },
  rowTitle: { fontSize: 18, fontWeight: '600' },
  chevron: { fontSize: 30, lineHeight: 32 },
  pressed: { opacity: 0.72 },
});
