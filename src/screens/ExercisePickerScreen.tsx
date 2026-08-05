import { usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { exerciseNameKey } from '../domain/exerciseName';
import { addExerciseToWorkout, countExercises, listAvailableExercises, type AvailableExercise } from '../database/workouts';

type Props = NativeStackScreenProps<RootStackParamList, 'ExercisePicker'>;
type State = { status: 'loading' } | { status: 'failed' } | {
  status: 'ready'; exercises: AvailableExercise[]; totalExerciseCount: number;
};

export function ExercisePickerScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<number>();
  const [saveError, setSaveError] = useState(false);
  const [reload, setReload] = useState(0);
  const allowNavigation = useRef(false);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listAvailableExercises(database, route.params.workoutId),
      countExercises(database),
    ]).then(
      ([exercises, totalExerciseCount]) => active && setState({ status: 'ready', exercises, totalExerciseCount }),
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.workoutId]);
  useEffect(() => { if (state.status === 'ready' && state.exercises.length > 0) searchRef.current?.focus(); }, [state]);
  usePreventRemove(saving, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  async function select(exerciseId: number) {
    setSaving(true);
    setSavingExerciseId(exerciseId);
    setSaveError(false);
    try {
      await addExerciseToWorkout(database, route.params.workoutId, exerciseId);
      allowNavigation.current = true;
      navigation.popTo('Workout', { focusExerciseId: exerciseId });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
      setSavingExerciseId(undefined);
    }
  }

  if (state.status === 'loading') return <ActivityIndicator accessibilityLabel="Laster øvelser" style={styles.center} />;
  if (state.status === 'failed') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Kunne ikke laste inn</Text>
      <Action label="Prøv igjen" onPress={() => setReload((value) => value + 1)} primary />
    </View>
  );

  const matches = state.exercises.filter((exercise) => exerciseNameKey(exercise.name).includes(exerciseNameKey(query)));
  const emptyInstallation = state.totalExerciseCount === 0;
  const allAdded = state.exercises.length === 0 && state.totalExerciseCount > 0;

  function create(initialName?: string) {
    navigation.navigate('CreateExercise', {
      initialName,
      origin: 'workout',
      workoutId: route.params.workoutId,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!emptyInstallation && (
        <TextInput
          accessibilityLabel="Søk i øvelser"
          autoCapitalize="none"
          editable={!saving}
          onChangeText={setQuery}
          placeholder="Søk"
          placeholderTextColor={colors.border}
          ref={searchRef}
          style={[styles.search, { borderColor: colors.border, color: colors.text }]}
          value={query}
        />
      )}
      {saveError && (
        <Text accessibilityRole="alert" style={{ color: colors.notification }}>
          Kunne ikke legge til øvelsen. Prøv igjen.
        </Text>
      )}
      {emptyInstallation ? (
        <Action label="Opprett første øvelse" onPress={() => create()} primary />
      ) : allAdded ? (
        <View style={styles.center}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Alle eksisterende øvelser er lagt til</Text>
          <Action label="Opprett øvelse" onPress={() => create()} primary />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Ingen øvelser funnet</Text>
          <Action label={`Opprett «${query}»`} onPress={() => create(query)} primary />
        </View>
      ) : (
        <>
          <View style={[styles.exerciseList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {matches.map((exercise, index) => (
              <ExerciseRow
                busy={savingExerciseId === exercise.id}
                disabled={saving}
                key={exercise.id}
                label={savingExerciseId === exercise.id ? 'Legger til…' : exercise.name}
                last={index === matches.length - 1}
                onPress={() => void select(exercise.id)}
              />
            ))}
          </View>
          <Action disabled={saving} label="Opprett øvelse" onPress={() => create()} primary />
        </>
      )}
      <Action disabled={saving} label="Avbryt" onPress={() => navigation.popTo('Workout', { focusAddExercise: true })} secondary />
    </ScrollView>
  );
}

function ExerciseRow({ busy, disabled, label, last, onPress }: {
  busy: boolean; disabled: boolean; label: string; last: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exerciseRow,
        { borderBottomColor: colors.border },
        last && styles.lastExerciseRow,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.exerciseName, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Action({ busy = false, disabled = false, label, onPress, primary = false, secondary = false }: {
  busy?: boolean; disabled?: boolean; label: string; onPress: () => void; primary?: boolean; secondary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary ? styles.secondaryAction : styles.borderedAction,
        !secondary && { backgroundColor: primary ? colors.primary : colors.card, borderColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  search: { borderRadius: 12, borderWidth: 1, fontSize: 17, minHeight: 50, paddingHorizontal: 16 },
  exerciseList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  exerciseRow: { borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 },
  lastExerciseRow: { borderBottomWidth: 0 },
  exerciseName: { fontSize: 18, fontWeight: '600' },
  action: { alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingHorizontal: 20, paddingVertical: 12 },
  borderedAction: { borderRadius: 14, borderWidth: 1 },
  secondaryAction: { minHeight: 48 },
  actionText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
