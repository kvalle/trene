import { useFocusEffect, usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  cancelActiveWorkout,
  confirmWorkoutSet,
  deletePlannedWorkoutSet,
  loadActiveWorkout,
  savePlannedWorkoutSet,
  unconfirmWorkoutSet,
  type ActiveWorkout,
  type WorkoutSet,
} from '../database/workouts';
import { parseLoad, parseRepetitions, validateWorkoutSet } from '../domain/workoutSet';
import { formatLoad } from '../locale';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; workout: ActiveWorkout };
type Draft = {
  load: string;
  repetitions: string;
  loadError?: string;
  repetitionsError?: string;
  unsaved?: boolean;
  confirmationFailed?: boolean;
};

function parsedValue(input: string, parser: (value: string) => { value: number } | { error: string }) {
  const result = parser(input);
  return 'value' in result ? result.value : undefined;
}

function isDirty(set: WorkoutSet, draft?: Draft): boolean {
  if (!draft) return false;
  const load = parsedValue(draft.load, parseLoad);
  const repetitions = parsedValue(draft.repetitions, parseRepetitions);
  return (load !== undefined && load !== set.loadKg)
    || (repetitions !== undefined && repetitions !== set.repetitions);
}

function compareWorkoutSets(left: WorkoutSet, right: WorkoutSet): number {
  if (left.confirmedAt === null) return right.confirmedAt === null ? left.id - right.id : 1;
  if (right.confirmedAt === null) return -1;
  return left.confirmedAt.localeCompare(right.confirmedAt) || left.id - right.id;
}

export function WorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [expandedId, setExpandedId] = useState<number>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [pendingSetId, setPendingSetId] = useState<number>();
  const [setFailure, setSetFailure] = useState<{ setId: number; message: string; retry: () => void }>();
  const addExerciseRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const confirmCancelRef = useRef<View>(null);
  const retryCancelRef = useRef<View>(null);
  const allowNavigation = useRef(false);
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

  const hasDirtyDraft = state.status === 'ready' && state.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => set.confirmedAt === null && isDirty(set, drafts[set.id])),
  );

  usePreventRemove(cancelling || pendingSetId !== undefined || hasDirtyDraft, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
    else if (!cancelling && pendingSetId === undefined) {
      void flushDrafts().then((saved) => {
        if (!saved) return;
        allowNavigation.current = true;
        navigation.dispatch(data.action);
        allowNavigation.current = false;
      });
    }
  });

  useEffect(() => AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') void flushDrafts();
  }).remove, [state, drafts]);

  function focus(ref: React.RefObject<View | null>) {
    const handle = findNodeHandle(ref.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function closeCancelDialog() {
    if (cancelling) return;
    setCancelDialogOpen(false);
    requestAnimationFrame(() => focus(cancelRef));
  }

  function draftFor(set: WorkoutSet): Draft {
    return drafts[set.id] ?? {
      load: set.loadKg === null ? '' : formatLoad(set.loadKg),
      repetitions: set.repetitions?.toString() ?? '',
    };
  }

  function updateDraft(set: WorkoutSet, update: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [set.id]: {
        ...(current[set.id] ?? {
          load: set.loadKg === null ? '' : formatLoad(set.loadKg),
          repetitions: set.repetitions?.toString() ?? '',
        }),
        ...update,
      },
    }));
  }

  function updateWorkoutSet(setId: number, update: (set: WorkoutSet) => WorkoutSet | null) {
    setState((current) => current.status !== 'ready' ? current : ({
      status: 'ready',
      workout: {
        ...current.workout,
        exercises: current.workout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.flatMap((set) => {
            if (set.id !== setId) return [set];
            const next = update(set);
            return next ? [next] : [];
          }).sort(compareWorkoutSets),
        })),
      },
    }));
  }

  async function saveDraft(
    workoutId: number,
    set: WorkoutSet,
    exerciseName: string,
    draft = draftFor(set),
  ): Promise<boolean> {
    const load = parseLoad(draft.load);
    const repetitions = parseRepetitions(draft.repetitions);
    const loadValue = 'value' in load ? load.value : set.loadKg;
    const repetitionsValue = 'value' in repetitions ? repetitions.value : set.repetitions;
    updateDraft(set, {
      loadError: 'error' in load ? load.error : undefined,
      repetitionsError: 'error' in repetitions ? repetitions.error : undefined,
    });
    if (loadValue === set.loadKg && repetitionsValue === set.repetitions) return true;
    setPendingSetId(set.id);
    try {
      await savePlannedWorkoutSet(database, workoutId, set.id, loadValue, repetitionsValue);
      updateDraft(set, { unsaved: false });
      updateWorkoutSet(set.id, (current) => ({ ...current, loadKg: loadValue, repetitions: repetitionsValue }));
      return true;
    } catch {
      updateDraft(set, { unsaved: true });
      AccessibilityInfo.announceForAccessibility(`Endringene for ${exerciseName} er ikke lagret.`);
      return false;
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function flushDrafts(): Promise<boolean> {
    if (state.status !== 'ready') return true;
    for (const exercise of state.workout.exercises) {
      for (const set of exercise.sets) {
        const draft = drafts[set.id];
        if (set.confirmedAt === null && isDirty(set, draft) && !draft?.unsaved) {
          if (!await saveDraft(state.workout.id, set, exercise.name, draft)) return false;
        }
      }
    }
    return true;
  }

  async function confirmSet(workoutId: number, set: WorkoutSet, exerciseName: string) {
    const draft = draftFor(set);
    const validation = validateWorkoutSet(draft.load, draft.repetitions);
    if (!('loadKg' in validation)) {
      updateDraft(set, validation);
      AccessibilityInfo.announceForAccessibility('Kontroller belastning og repetisjoner.');
      return;
    }
    const confirmedAt = new Date().toISOString();
    setPendingSetId(set.id);
    try {
      await confirmWorkoutSet(database, workoutId, set.id, validation.loadKg, validation.repetitions, confirmedAt);
      setDrafts((current) => { const next = { ...current }; delete next[set.id]; return next; });
      updateWorkoutSet(set.id, (current) => ({
        ...current,
        loadKg: validation.loadKg,
        repetitions: validation.repetitions,
        confirmedAt,
      }));
      AccessibilityInfo.announceForAccessibility(`Sett bekreftet for ${exerciseName}.`);
    } catch {
      updateDraft(set, { confirmationFailed: true });
      AccessibilityInfo.announceForAccessibility('Kunne ikke bekrefte settet. Prøv igjen.');
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function mutateSet(
    setId: number,
    operation: () => Promise<void>,
    apply: (set: WorkoutSet) => WorkoutSet | null,
    failure: string,
  ) {
    setPendingSetId(setId);
    setSetFailure(undefined);
    try {
      await operation();
      updateWorkoutSet(setId, apply);
    } catch {
      AccessibilityInfo.announceForAccessibility(failure);
      setSetFailure({ setId, message: failure, retry: () => void mutateSet(setId, operation, apply, failure) });
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function confirmCancellation(workoutId: number) {
    setCancelling(true);
    setCancelFailed(false);
    try {
      await cancelActiveWorkout(database, workoutId);
      setCancelDialogOpen(false);
      allowNavigation.current = true;
      navigation.popTo('Home', { focusStartWorkout: true });
    } catch {
      setCancelDialogOpen(false);
      setCancelFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke avbryte økten. Prøv igjen.');
      requestAnimationFrame(() => focus(retryCancelRef));
    } finally {
      setCancelling(false);
    }
  }

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
            {expanded && exercise.sets.map((set, index) => set.confirmedAt ? (
              <View key={set.id} style={[styles.receipt, { borderColor: colors.border }]}>
                <View
                  accessible
                  accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg!)} kilogram`}
                  style={styles.receiptText}
                >
                  <Text style={[styles.setTitle, { color: colors.text }]}>Sett {index + 1}</Text>
                  <Text style={{ color: colors.text }}>{formatLoad(set.loadKg!)} kg · {set.repetitions} repetisjoner</Text>
                </View>
                <Button
                  accessibilityLabel={`Rediger sett ${index + 1}`}
                  disabled={pendingSetId !== undefined}
                  label="Rediger"
                  onPress={() => void mutateSet(
                    set.id,
                    () => unconfirmWorkoutSet(database, state.workout.id, set.id),
                    (current) => ({ ...current, confirmedAt: null }),
                    'Kunne ikke redigere settet. Prøv igjen.',
                  )}
                />
                {setFailure?.setId === set.id && (
                  <View style={styles.failure}>
                    <Text accessibilityRole="alert" style={{ color: colors.notification }}>{setFailure.message}</Text>
                    <Button label="Prøv igjen" onPress={setFailure.retry} />
                  </View>
                )}
              </View>
            ) : (() => {
              const draft = draftFor(set);
              const busy = pendingSetId === set.id;
              return (
                <View key={set.id} style={styles.set}>
                  <Text style={[styles.setTitle, { color: colors.text }]}>Planlagt sett</Text>
                  <View style={styles.fields}>
                    <View style={styles.field}>
                      <TextInput
                        accessibilityLabel={`Belastning for ${exercise.name}`}
                        keyboardType="decimal-pad"
                        onBlur={() => void saveDraft(state.workout.id, set, exercise.name)}
                        onChangeText={(load) => updateDraft(set, { load, loadError: undefined })}
                        placeholder="Belastning"
                        placeholderTextColor={colors.border}
                        style={[styles.input, { borderColor: draft.loadError ? colors.notification : colors.border, color: colors.text }]}
                        value={draft.load}
                      />
                      {draft.loadError && <Text accessibilityRole="alert" style={{ color: colors.notification }}>{draft.loadError}</Text>}
                    </View>
                    <View style={styles.field}>
                      <TextInput
                        accessibilityLabel={`Repetisjoner for ${exercise.name}`}
                        keyboardType="number-pad"
                        onBlur={() => void saveDraft(state.workout.id, set, exercise.name)}
                        onChangeText={(repetitions) => updateDraft(set, { repetitions, repetitionsError: undefined })}
                        placeholder="Repetisjoner"
                        placeholderTextColor={colors.border}
                        style={[styles.input, { borderColor: draft.repetitionsError ? colors.notification : colors.border, color: colors.text }]}
                        value={draft.repetitions}
                      />
                      {draft.repetitionsError && <Text accessibilityRole="alert" style={{ color: colors.notification }}>{draft.repetitionsError}</Text>}
                    </View>
                  </View>
                  {draft.unsaved && !draft.confirmationFailed && (
                    <View style={styles.failure}>
                      <Text accessibilityRole="alert" style={{ color: colors.notification }}>Endringene er ikke lagret</Text>
                      <Button disabled={busy} label="Prøv å lagre igjen" onPress={() => void saveDraft(state.workout.id, set, exercise.name)} />
                    </View>
                  )}
                  {draft.confirmationFailed && (
                    <View style={styles.failure}>
                      <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke bekrefte settet</Text>
                      <Button
                        disabled={busy}
                        label="Prøv å bekrefte igjen"
                        onPress={() => void confirmSet(state.workout.id, set, exercise.name)}
                      />
                    </View>
                  )}
                  <View style={styles.setActions}>
                    <Button
                      accessibilityLabel={`Bekreft planlagt sett for ${exercise.name}`}
                      disabled={pendingSetId !== undefined || draft.unsaved || draft.confirmationFailed}
                      label={busy ? 'Lagrer' : 'Bekreft'}
                      onPress={() => void confirmSet(state.workout.id, set, exercise.name)}
                      primary
                    />
                    <Button
                      accessibilityLabel={`Slett planlagt sett for ${exercise.name}`}
                      disabled={pendingSetId !== undefined}
                      label="Slett"
                      onPress={() => void mutateSet(
                        set.id,
                        () => deletePlannedWorkoutSet(database, state.workout.id, set.id),
                        () => null,
                        'Kunne ikke slette settet. Prøv igjen.',
                      )}
                    />
                  </View>
                  {setFailure?.setId === set.id && (
                    <View style={styles.failure}>
                      <Text accessibilityRole="alert" style={{ color: colors.notification }}>{setFailure.message}</Text>
                      <Button label="Prøv igjen" onPress={setFailure.retry} />
                    </View>
                  )}
                </View>
              );
            })())}
            {expanded && <Button disabled label="Legg til sett" onPress={() => undefined} />}
          </View>
        );
      })}
      <Button
        buttonRef={addExerciseRef}
        disabled={pendingSetId !== undefined}
        label="Legg til øvelse"
        onPress={() => void flushDrafts().then((saved) => { if (saved) {
          navigation.setParams({ focusAddExercise: true });
          navigation.navigate('ExercisePicker', { workoutId: state.workout.id });
        } })}
      />
      <Button disabled label="Ferdig" onPress={() => undefined} primary />
      <Button buttonRef={cancelRef} disabled={pendingSetId !== undefined} label="Avbryt" onPress={() => {
        setCancelFailed(false);
        setCancelDialogOpen(true);
      }} />
      {cancelFailed && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={{ color: colors.notification }}>
            Kunne ikke avbryte økten
          </Text>
          <Button buttonRef={retryCancelRef} label="Prøv igjen" onPress={() => setCancelDialogOpen(true)} />
        </View>
      )}
      <Modal
        animationType="none"
        onRequestClose={closeCancelDialog}
        onShow={() => focus(confirmCancelRef)}
        transparent
        visible={cancelDialogOpen}
      >
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text accessibilityRole="header" style={[styles.dialogTitle, { color: colors.text }]}>Avbryt økten?</Text>
            <Text style={{ color: colors.text }}>Økten slettes permanent og vises ikke i historikken.</Text>
            <Button disabled={cancelling} label="Behold økten" onPress={closeCancelDialog} />
            <Button
              buttonRef={confirmCancelRef}
              disabled={cancelling}
              label={cancelling ? 'Avbryter' : 'Avbryt økten'}
              onPress={() => void confirmCancellation(state.workout.id)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Button({ accessibilityLabel, buttonRef, disabled = false, label, onPress, primary = false }: {
  accessibilityLabel?: string;
  buttonRef?: React.RefObject<View | null>;
  disabled?: boolean; label: string; onPress: () => void; primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
  set: { gap: 10, paddingVertical: 4 },
  setTitle: { fontSize: 16, fontWeight: '600' },
  fields: { gap: 10 },
  field: { gap: 6 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  receipt: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingBottom: 12 },
  receiptText: { flex: 1, gap: 4 },
  setActions: { flexDirection: 'row', gap: 10 },
  button: { alignItems: 'center', borderRadius: 13, borderWidth: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  failure: { gap: 10 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 16, gap: 16, maxWidth: 440, padding: 24, width: '100%' },
  dialogTitle: { fontSize: 24, fontWeight: '700' },
});
