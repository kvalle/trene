import { useTheme } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { typography } from '../theme';

export function PlaceholderScreen({ title }: { title: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, styles.body, { color: colors.text }]}>Denne delen kommer i neste leveranse.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  body: { marginTop: 16 },
});
