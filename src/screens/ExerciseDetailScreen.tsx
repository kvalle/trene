import { useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;

export function ExerciseDetailScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'failed' } | { status: 'ready'; name?: string }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void database.getFirstAsync<{ name: string }>('SELECT name FROM exercises WHERE id = ?', route.params.exerciseId)
      .then(
        (exercise) => active && setState({ status: 'ready', name: exercise?.name }),
        () => active && setState({ status: 'failed' }),
      );
    return () => { active = false; };
  }, [database, reload, route.params.exerciseId]);

  if (state.status === 'loading') {
    return <ActivityIndicator accessibilityLabel="Laster øvelse" style={styles.container} />;
  }
  if (state.status === 'failed') {
    return (
      <View style={styles.container}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Kunne ikke laste inn</Text>
        <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.retry}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Prøv igjen</Text>
        </Pressable>
      </View>
    );
  }

  const name = state.name ?? 'Finnes ikke lenger';

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{name}</Text>
      {!state.name && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Exercises')}
          style={styles.retry}
        >
          <Text style={[styles.retryText, { color: colors.primary }]}>Tilbake til øvelser</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 30, fontWeight: '700' },
  retry: { alignItems: 'center', justifyContent: 'center', marginTop: 24, minHeight: 48 },
  retryText: { fontSize: 17, fontWeight: '700' },
});
