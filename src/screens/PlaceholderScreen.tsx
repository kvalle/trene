import { useTheme } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

export function PlaceholderScreen({ title }: { title: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>Denne delen kommer i neste leveranse.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 17, marginTop: 16 },
});
