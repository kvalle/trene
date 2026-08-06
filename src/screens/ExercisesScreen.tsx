import { useFocusEffect, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { listExercises, searchExercises, type ExerciseListItem } from '../database/exercises';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;
type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; exercises: ExerciseListItem[] };

export function ExercisesScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const retryRef = useRef<View>(null);
  const emptyActionRef = useRef<View>(null);
  const exerciseRefs = useRef(new Map<number, View>());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => current.status === 'ready' ? current : { status: 'loading' });
      listExercises(database).then(
        (exercises) => active && setState({ status: 'ready', exercises }),
        () => active && setState({ status: 'failed' }),
      );
      return () => { active = false; };
    }, [database, reload]),
  );

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const focusExerciseId = route.params?.focusExerciseId;
    const target = focusExerciseId === undefined ? null : exerciseRefs.current.get(focusExerciseId);
    if (focusExerciseId !== undefined && !target && query.length > 0) {
      setQuery('');
      return;
    }
    const handle = findNodeHandle(target ?? (route.params?.focusEmptyAction ? emptyActionRef.current : null));
    if (!handle) return;
    AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ focusExerciseId: undefined, focusEmptyAction: undefined });
  }, [navigation, query, route.params?.focusEmptyAction, route.params?.focusExerciseId, state]);

  if (state.status === 'loading') {
    return <ActivityIndicator accessibilityLabel="Laster øvelser" style={styles.center} />;
  }

  if (state.status === 'failed') {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Kunne ikke laste inn</Text>
        <Action actionRef={retryRef} label="Prøv igjen" onPress={() => setReload((value) => value + 1)} primary />
      </View>
    );
  }

  const matches = searchExercises(state.exercises, query);
  const isEmpty = state.exercises.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!isEmpty && (
        <TextInput
          accessibilityLabel="Søk i øvelser"
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Søk"
          placeholderTextColor={colors.border}
          returnKeyType="search"
          style={[styles.search, { borderColor: colors.border, color: colors.text }]}
          value={query}
        />
      )}

      {isEmpty ? (
        <Action actionRef={emptyActionRef} label="Opprett første øvelse" onPress={() => navigation.navigate('CreateExercise')} primary />
      ) : matches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Ingen øvelser funnet</Text>
          <Action
            label={`Opprett «${query}»`}
            onPress={() => navigation.navigate('CreateExercise', { initialName: query })}
            primary
          />
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {matches.map((exercise) => (
              <Pressable
                accessibilityHint="Åpner detaljer for øvelsen"
                accessibilityRole="button"
                key={exercise.id}
                onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: exercise.id })}
                ref={(node) => {
                  if (node) exerciseRefs.current.set(exercise.id, node);
                  else exerciseRefs.current.delete(exercise.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rowName, { color: colors.text }]}>{exercise.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.text }]}>
                  Brukt i {exercise.workoutCount} {exercise.workoutCount === 1 ? 'økt' : 'økter'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Action label="Opprett øvelse" onPress={() => navigation.navigate('CreateExercise')} />
        </>
      )}
    </ScrollView>
  );
}

function Action({ actionRef, label, onPress, primary = false }: {
  actionRef?: React.RefObject<View | null>; label: string; onPress: () => void; primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      ref={actionRef}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? colors.primary : colors.card, borderColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 24, justifyContent: 'center', padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  search: { borderRadius: 12, borderWidth: 1, fontSize: 17, minHeight: 50, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', flex: 1, gap: 24, justifyContent: 'center' },
  list: { gap: 10 },
  row: { borderRadius: 14, borderWidth: 1, minHeight: 72, padding: 14 },
  rowName: { fontSize: 18, fontWeight: '600' },
  rowMeta: { fontSize: 15, marginTop: 5, opacity: 0.75 },
  action: { alignItems: 'center', borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 },
  actionText: { fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
