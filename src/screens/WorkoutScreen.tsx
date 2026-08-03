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
import { loadActiveWorkout, type ActiveWorkout } from '../database/workouts';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; workout: ActiveWorkout };

export function WorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [expandedId, setExpandedId] = useState<number>();
  const addExerciseRef = useRef<View>(null);
  const cardRefs = useRef(new Map<number, View>());

  useFocusEffect(useCallback(() => {
    let active = true;
    loadActiveWorkout(database).then(
      (workout) => {
        if (!active) return;
        if (!workout) setState({ status: 'failed' });
        else {
          setState({ status: 'ready', workout });
          setExpandedId((current) => route.params?.focusExerciseId ?? current ?? workout.exercises[0]?.exerciseId);
        }
      },
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload]));

  useEffect(() => {
    if (state.status !== 'ready') return;
    const target = route.params?.focusExerciseId
      ? cardRefs.current.get(route.params.focusExerciseId)
      : route.params?.focusAddExercise ? addExerciseRef.current : null;
    const handle = target && findNodeHandle(target);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    if (target) navigation.setParams({ focusExerciseId: undefined, focusAddExercise: undefined });
  }, [navigation, route.params, state]);

  if (state.status === 'loading') return <ActivityIndicator accessibilityLabel="Laster treningsøkt" style={styles.center} />;
  if (state.status === 'failed') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Kunne ikke laste inn</Text>
      <Button label="Prøv igjen" onPress={() => setReload((value) => value + 1)} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {state.workout.exercises.length === 0 && (
        <Text style={[styles.empty, { color: colors.text }]}>Ingen øvelser lagt til ennå</Text>
      )}
      {state.workout.exercises.map((exercise) => {
        const expanded = expandedId === exercise.exerciseId;
        const completed = exercise.sets.filter((set) => set.confirmedAt !== null).length;
        return (
          <View key={exercise.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpandedId(expanded ? undefined : exercise.exerciseId)}
              ref={(node) => { if (node) cardRefs.current.set(exercise.exerciseId, node); }}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>{exercise.name}</Text>
              {!expanded && <Text style={{ color: colors.text }}>{completed} av {exercise.sets.length} sett gjennomført</Text>}
            </Pressable>
            {expanded && exercise.sets.map((set) => (
              <View key={set.id} style={styles.set}>
                <Text style={[styles.setTitle, { color: colors.text }]}>Planlagt sett</Text>
                <View style={styles.fields}>
                  <TextInput
                    accessibilityLabel={`Belastning for ${exercise.name}`}
                    defaultValue={set.loadKg?.toString() ?? ''}
                    keyboardType="decimal-pad"
                    placeholder="Belastning"
                    placeholderTextColor={colors.border}
                    style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  />
                  <TextInput
                    accessibilityLabel={`Repetisjoner for ${exercise.name}`}
                    defaultValue={set.repetitions?.toString() ?? ''}
                    keyboardType="number-pad"
                    placeholder="Repetisjoner"
                    placeholderTextColor={colors.border}
                    style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  />
                </View>
              </View>
            ))}
            {expanded && <Button disabled label="Legg til sett" onPress={() => undefined} />}
          </View>
        );
      })}
      <Button
        buttonRef={addExerciseRef}
        label="Legg til øvelse"
        onPress={() => {
          navigation.setParams({ focusAddExercise: true });
          navigation.navigate('ExercisePicker', { workoutId: state.workout.id });
        }}
      />
      <Button disabled label="Ferdig" onPress={() => undefined} primary />
      <Button label="Avbryt" onPress={() => undefined} />
    </ScrollView>
  );
}

function Button({ buttonRef, disabled = false, label, onPress, primary = false }: {
  buttonRef?: React.RefObject<View | null>;
  disabled?: boolean; label: string; onPress: () => void; primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      ref={buttonRef}
      style={[styles.button, { backgroundColor: primary ? colors.primary : colors.card, borderColor: colors.border }, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, { color: primary ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  heading: { fontSize: 24, fontWeight: '700' },
  empty: { fontSize: 18, paddingVertical: 36, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, gap: 16, padding: 16 },
  cardTitle: { fontSize: 21, fontWeight: '700', marginBottom: 4 },
  set: { gap: 10 },
  setTitle: { fontSize: 16, fontWeight: '600' },
  fields: { flexDirection: 'row', gap: 10 },
  input: { borderRadius: 10, borderWidth: 1, flex: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  button: { alignItems: 'center', borderRadius: 13, borderWidth: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
