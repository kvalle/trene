import { useFocusEffect, usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  findNodeHandle,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  addWorkoutSet,
  cancelActiveWorkout,
  completeWorkout,
  confirmWorkoutSet,
  deletePlannedWorkoutSet,
  loadActiveWorkout,
  removeExerciseFromWorkout,
  savePlannedWorkoutSet,
  unconfirmWorkoutSet,
  type ActiveWorkout,
  type WorkoutSet,
} from '../database/workouts';
import { parseLoad, parseRepetitions, validateWorkoutSet } from '../domain/workoutSet';
import { formatLoad } from '../locale';
import { Button } from '../ui/Button';
import { CompactAction } from '../ui/CompactAction';
import { Dialog } from '../ui/Dialog';
import { DisclosureCard } from '../ui/DisclosureCard';
import { ErrorAlert } from '../ui/ErrorAlert';
import { FormSection } from '../ui/FormSection';
import { NumericField } from '../ui/NumericField';
import { PageStatus } from '../ui/PageStatus';
import { type WorkoutSetDraft, useWorkoutDrafts } from '../workoutDrafts';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; workout: ActiveWorkout };
function isDirty(set: WorkoutSet, draft?: WorkoutSetDraft): boolean {
  if (!draft) return false;
  const persistedLoad = set.loadKg === null ? '' : formatLoad(set.loadKg);
  const persistedRepetitions = set.repetitions?.toString() ?? '';
  return draft.load !== persistedLoad || draft.repetitions !== persistedRepetitions;
}

function compareWorkoutSets(left: WorkoutSet, right: WorkoutSet): number {
  if (left.confirmedAt === null) return right.confirmedAt === null ? left.id - right.id : 1;
  if (right.confirmedAt === null) return -1;
  return left.confirmedAt.localeCompare(right.confirmedAt) || left.id - right.id;
}

export function WorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const { drafts, setDrafts } = useWorkoutDrafts();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [expandedId, setExpandedId] = useState<number>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [removeExerciseId, setRemoveExerciseId] = useState<number>();
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeFailed, setCompleteFailed] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [pendingSetId, setPendingSetId] = useState<number>();
  const [pendingExerciseOperation, setPendingExerciseOperation] = useState<'add-set' | 'remove-exercise'>();
  const [setFailure, setSetFailure] = useState<{ setId: number; message: string; retry: () => void }>();
  const [setRetryFocus, setSetRetryFocus] = useState<{ setId: number }>();
  const [exerciseFailure, setExerciseFailure] = useState<{
    workoutExerciseId: number; message: string; operation: 'add-set' | 'remove-exercise';
  }>();
  const addExerciseRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const completeRef = useRef<View>(null);
  const confirmCompleteRef = useRef<View>(null);
  const retryCompleteRef = useRef<View>(null);
  const confirmCancelRef = useRef<View>(null);
  const retryCancelRef = useRef<View>(null);
  const confirmRemoveRef = useRef<View>(null);
  const removeExerciseRefs = useRef(new Map<number, View>());
  const exerciseRetryRefs = useRef(new Map<number, View>());
  const allowNavigation = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const lifecycleFlush = useRef(Promise.resolve(true));
  const saveQueueFailed = useRef(false);
  const pendingSaves = useRef(0);
  const cardRefs = useRef(new Map<number, View>());
  const loadInputRefs = useRef(new Map<number, TextInput>());
  const repetitionsInputRefs = useRef(new Map<number, TextInput>());
  const retryRefs = useRef(new Map<number, View>());

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
    if (state.status === 'ready') {
      saveQueueFailed.current = Object.values(drafts).some((draft) =>
        draft.workoutId === state.workout.id && draft.unsaved,
      );
    }
  }, [drafts, state]);

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
    exercise.sets.some((set) => set.confirmedAt === null && isDirty(
      set,
      drafts[set.id]?.workoutId === state.workout.id ? drafts[set.id] : undefined,
    )),
  );
  const hasUnsavedDraft = state.status === 'ready' && Object.values(drafts).some((draft) =>
    draft.workoutId === state.workout.id && draft.unsaved,
  );

  usePreventRemove(cancelling || completing || pendingSetId !== undefined || pendingExerciseOperation !== undefined || hasDirtyDraft, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
    else if (!cancelling && !completing && pendingSetId === undefined && pendingExerciseOperation === undefined && hasUnsavedDraft) {
      navigation.dispatch(data.action);
    } else if (!cancelling && !completing && pendingSetId === undefined && pendingExerciseOperation === undefined) {
      void flushDrafts().then((saved) => {
        if (!saved) return;
        allowNavigation.current = true;
        navigation.dispatch(data.action);
        allowNavigation.current = false;
      });
    }
  });

  useEffect(() => AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void lifecycleFlush.current.then(() => setReload((value) => value + 1));
    }
    else lifecycleFlush.current = flushDrafts();
  }).remove, [state, drafts]);

  useEffect(() => {
    if (!setRetryFocus) return;
    focus({ current: retryRefs.current.get(setRetryFocus.setId) ?? null });
  }, [setRetryFocus]);

  useEffect(() => {
    if (cancelFailed) focus(retryCancelRef);
  }, [cancelFailed]);

  useEffect(() => {
    if (completeFailed) focus(retryCompleteRef);
  }, [completeFailed]);

  useEffect(() => {
    if (exerciseFailure) {
      focus({ current: exerciseRetryRefs.current.get(exerciseFailure.workoutExerciseId) ?? null });
    }
  }, [exerciseFailure]);

  function focus(ref: React.RefObject<View | null>) {
    const handle = findNodeHandle(ref.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function closeCancelDialog() {
    if (cancelling) return;
    setCancelDialogOpen(false);
    requestAnimationFrame(() => focus(cancelRef));
  }

  function closeRemoveDialog() {
    if (pendingExerciseOperation === 'remove-exercise') return;
    const workoutExerciseId = removeExerciseId;
    setRemoveExerciseId(undefined);
    requestAnimationFrame(() => focus({
      current: workoutExerciseId ? removeExerciseRefs.current.get(workoutExerciseId) ?? null : null,
    }));
  }

  function draftFor(set: WorkoutSet): WorkoutSetDraft {
    if (state.status !== 'ready') throw new Error('Workout draft requested before workout loaded');
    const draft = drafts[set.id];
    return draft?.workoutId === state.workout.id ? draft : {
      workoutId: state.workout.id,
      load: set.loadKg === null ? '' : formatLoad(set.loadKg),
      repetitions: set.repetitions?.toString() ?? '',
    };
  }

  function updateDraft(set: WorkoutSet, update: Partial<WorkoutSetDraft>) {
    if (state.status !== 'ready') throw new Error('Workout draft updated before workout loaded');
    setDrafts((current) => ({
      ...current,
      [set.id]: {
        ...(current[set.id]?.workoutId === state.workout.id ? current[set.id] : {
          workoutId: state.workout.id,
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

  function updateWorkoutExercise(workoutExerciseId: number, update: (sets: WorkoutSet[]) => WorkoutSet[] | null) {
    setState((current) => current.status !== 'ready' ? current : ({
      status: 'ready',
      workout: {
        ...current.workout,
        exercises: current.workout.exercises.flatMap((exercise) => {
          if (exercise.id !== workoutExerciseId) return [exercise];
          const sets = update(exercise.sets);
          return sets ? [{ ...exercise, sets }] : [];
        }),
      },
    }));
  }

  async function saveDraft(
    workoutId: number,
    set: WorkoutSet,
    exerciseName: string,
    draft = draftFor(set),
    manualRetry = false,
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
    pendingSaves.current += 1;
    setPendingSetId(set.id);
    const operation = async () => {
      try {
        if ((saveQueueFailed.current || draft.unsaved) && !manualRetry) {
          updateDraft(set, { unsaved: true });
          setSetRetryFocus({ setId: set.id });
          return false;
        }
        await savePlannedWorkoutSet(database, workoutId, set.id, loadValue, repetitionsValue);
        saveQueueFailed.current = false;
        updateDraft(set, { unsaved: false });
        updateWorkoutSet(set.id, (current) => ({ ...current, loadKg: loadValue, repetitions: repetitionsValue }));
        return true;
      } catch {
        saveQueueFailed.current = true;
        updateDraft(set, { unsaved: true });
        AccessibilityInfo.announceForAccessibility(`Endringene for ${exerciseName} er ikke lagret.`);
        setSetRetryFocus({ setId: set.id });
        return false;
      } finally {
        pendingSaves.current -= 1;
        if (pendingSaves.current === 0) setPendingSetId(undefined);
      }
    };
    const queued = saveQueue.current.then(operation, operation);
    saveQueue.current = queued.then(() => undefined);
    return queued;
  }

  async function flushDrafts(): Promise<boolean> {
    if (state.status !== 'ready') return true;
    for (const exercise of state.workout.exercises) {
      for (const set of exercise.sets) {
        const draft = drafts[set.id]?.workoutId === state.workout.id ? drafts[set.id] : undefined;
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
      const invalidInput = validation.loadError
        ? loadInputRefs.current.get(set.id)
        : repetitionsInputRefs.current.get(set.id);
      requestAnimationFrame(() => focus({ current: invalidInput ?? null }));
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      updateDraft(set, { confirmationFailed: true });
      AccessibilityInfo.announceForAccessibility('Kunne ikke bekrefte settet. Prøv igjen.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSetRetryFocus({ setId: set.id });
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function mutateSet(
    setId: number,
    operation: () => Promise<void>,
    apply: (set: WorkoutSet) => WorkoutSet | null,
    failure: string,
    removeDraft = false,
  ) {
    setPendingSetId(setId);
    setSetFailure(undefined);
    try {
      await operation();
      updateWorkoutSet(setId, apply);
      if (removeDraft) {
        setDrafts((current) => { const next = { ...current }; delete next[setId]; return next; });
      }
    } catch {
      AccessibilityInfo.announceForAccessibility(failure);
      setSetFailure({
        setId,
        message: failure,
        retry: () => void mutateSet(setId, operation, apply, failure, removeDraft),
      });
      setSetRetryFocus({ setId });
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function confirmCancellation(workoutId: number) {
    setCancelling(true);
    setCancelFailed(false);
    try {
      await cancelActiveWorkout(database, workoutId);
      setDrafts({});
      setCancelDialogOpen(false);
      allowNavigation.current = true;
      navigation.popTo('Home', { focusStartWorkout: true });
    } catch {
      setCancelDialogOpen(false);
      setCancelFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke avbryte økten. Prøv igjen.');
    } finally {
      setCancelling(false);
    }
  }

  async function confirmCompletion(workoutId: number) {
    setCompleting(true);
    setCompleteFailed(false);
    try {
      await completeWorkout(database, workoutId);
      setDrafts({});
      setCompleteDialogOpen(false);
      allowNavigation.current = true;
      navigation.replace('CompletedWorkout', { workoutId, fromCompletion: true });
    } catch {
      setCompleteDialogOpen(false);
      setCompleteFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke fullføre økten. Prøv igjen.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCompleting(false);
    }
  }

  async function addSet(workoutId: number, workoutExerciseId: number, exerciseName: string) {
    setPendingExerciseOperation('add-set');
    setExerciseFailure(undefined);
    try {
      const set = await addWorkoutSet(database, workoutId, workoutExerciseId);
      updateWorkoutExercise(workoutExerciseId, (sets) => [...sets, set].sort(compareWorkoutSets));
      AccessibilityInfo.announceForAccessibility(`Nytt planlagt sett lagt til for ${exerciseName}.`);
      void Haptics.selectionAsync();
    } catch {
      const message = 'Kunne ikke legge til settet. Prøv igjen.';
      setExerciseFailure({ workoutExerciseId, message, operation: 'add-set' });
      AccessibilityInfo.announceForAccessibility(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPendingExerciseOperation(undefined);
    }
  }

  async function removeExercise(workoutId: number, workoutExerciseId: number, exerciseName: string) {
    setPendingExerciseOperation('remove-exercise');
    setExerciseFailure(undefined);
    try {
      await removeExerciseFromWorkout(database, workoutId, workoutExerciseId);
      // Let the modal restore focus while its launcher still exists natively.
      setRemoveExerciseId(undefined);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      updateWorkoutExercise(workoutExerciseId, () => null);
      setDrafts((current) => {
        const next = { ...current };
        if (state.status === 'ready') {
          state.workout.exercises.find((exercise) => exercise.id === workoutExerciseId)?.sets.forEach((set) => delete next[set.id]);
        }
        return next;
      });
      setExpandedId(undefined);
      AccessibilityInfo.announceForAccessibility(`${exerciseName} fjernet fra økten.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      requestAnimationFrame(() => focus(addExerciseRef));
    } catch {
      const message = 'Kunne ikke fjerne øvelsen. Prøv igjen.';
      setRemoveExerciseId(undefined);
      setExerciseFailure({ workoutExerciseId, message, operation: 'remove-exercise' });
      AccessibilityInfo.announceForAccessibility(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPendingExerciseOperation(undefined);
    }
  }

  if (state.status === 'loading') return <PageStatus variant="loading" loaderLabel="Laster treningsøkt" />;
  if (state.status === 'failed') return <PageStatus variant="error" title="Kunne ikke laste inn" actionTitle="Prøv igjen" onAction={() => setReload((value) => value + 1)} />;

  const hasCompletedSet = state.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => set.confirmedAt !== null),
  );
  const hasPlannedSet = state.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => set.confirmedAt === null),
  );
  const workoutBusy = completing || pendingSetId !== undefined || pendingExerciseOperation !== undefined;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {state.workout.exercises.length === 0 && (
        <Text style={[styles.empty, { color: colors.text }]}>Ingen øvelser lagt til ennå</Text>
      )}
      {state.workout.exercises.map((exercise) => {
        const expanded = expandedId === exercise.exerciseId;
        const completed = exercise.sets.filter((set) => set.confirmedAt !== null).length;
        return (
          <DisclosureCard
            key={exercise.id}
            expanded={expanded}
            headerRef={(node) => { if (node) cardRefs.current.set(exercise.exerciseId, node); }}
            onPress={() => setExpandedId(expanded ? undefined : exercise.exerciseId)}
            summary={!expanded ? `${completed} av ${exercise.sets.length} sett gjennomført` : undefined}
            title={exercise.name}
          >
            {exercise.sets.map((set, index) => set.confirmedAt ? (
              <View key={set.id} style={[styles.receipt, { borderColor: colors.border }]}>
                <View
                  accessible
                  accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg!)} kilogram`}
                  style={styles.receiptText}
                >
                  <Text style={[styles.receiptTitle, { color: colors.text }]}>Sett {index + 1}</Text>
                  <Text style={{ color: colors.text }}>{formatLoad(set.loadKg!)} kg · {set.repetitions} repetisjoner</Text>
                </View>
                <CompactAction
                  accessibilityLabel={`Rediger sett ${index + 1}`}
                  disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined}
                  icon="✎"
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
                    <ErrorAlert message={setFailure.message} />
                    <Button ref={(node) => { if (node) retryRefs.current.set(set.id, node); }} title="Prøv igjen" variant="secondary" onPress={setFailure.retry} />
                  </View>
                )}
              </View>
            ) : (() => {
              const draft = draftFor(set);
              const busy = pendingSetId === set.id;
              return (
                <FormSection key={set.id} title="Planlagt sett">
                  <View style={styles.fields}>
                    <NumericField
                        aria-describedby={draft.loadError ? `load-error-${set.id}` : undefined}
                        aria-invalid={Boolean(draft.loadError)}
                        accessibilityLabel={`Belastning for ${exercise.name}`}
                        error={draft.loadError}
                        errorID={`load-error-${set.id}`}
                        kind="decimal"
                        label="Belastning"
                        onBlur={() => void saveDraft(state.workout.id, set, exercise.name)}
                        onChangeText={(load) => updateDraft(set, { load, loadError: undefined })}
                        placeholder="Belastning"
                        ref={(node) => { if (node) loadInputRefs.current.set(set.id, node); }}
                        value={draft.load}
                    />
                    <NumericField
                        aria-describedby={draft.repetitionsError ? `repetitions-error-${set.id}` : undefined}
                        aria-invalid={Boolean(draft.repetitionsError)}
                        accessibilityLabel={`Repetisjoner for ${exercise.name}`}
                        error={draft.repetitionsError}
                        errorID={`repetitions-error-${set.id}`}
                        kind="integer"
                        label="Repetisjoner"
                        onBlur={() => void saveDraft(state.workout.id, set, exercise.name)}
                        onChangeText={(repetitions) => updateDraft(set, { repetitions, repetitionsError: undefined })}
                        placeholder="Repetisjoner"
                        ref={(node) => { if (node) repetitionsInputRefs.current.set(set.id, node); }}
                        value={draft.repetitions}
                    />
                  </View>
                  {draft.unsaved && !draft.confirmationFailed && (
                    <View style={styles.failure}>
                      <ErrorAlert message="Endringene er ikke lagret" />
                      <Button ref={(node) => { if (node) retryRefs.current.set(set.id, node); }} disabled={busy} title="Prøv å lagre igjen" variant="secondary" onPress={() => void saveDraft(state.workout.id, set, exercise.name, undefined, true)} />
                    </View>
                  )}
                  {draft.confirmationFailed && (
                    <View style={styles.failure}>
                      <ErrorAlert message="Kunne ikke bekrefte settet" />
                      <Button
                        ref={(node) => { if (node) retryRefs.current.set(set.id, node); }}
                        disabled={busy}
                        title="Prøv å bekrefte igjen"
                        variant="secondary"
                        onPress={() => void confirmSet(state.workout.id, set, exercise.name)}
                      />
                    </View>
                  )}
                  <View accessibilityLabel={`Handlinger for planlagt sett for ${exercise.name}`} style={styles.setActions}>
                    <Button
                      accessibilityLabel={`Bekreft planlagt sett for ${exercise.name}`}
                      disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined || draft.unsaved || draft.confirmationFailed}
                      busy={busy}
                      title={busy ? 'Lagrer' : 'Bekreft'}
                      onPress={() => void confirmSet(state.workout.id, set, exercise.name)}
                    />
                    <CompactAction
                      accessibilityLabel={`Slett planlagt sett for ${exercise.name}`}
                      disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined}
                      icon="×"
                      label="Fjern sett"
                      onPress={() => void mutateSet(
                        set.id,
                        () => deletePlannedWorkoutSet(database, state.workout.id, set.id),
                        () => null,
                        'Kunne ikke slette settet. Prøv igjen.',
                        true,
                      )}
                    />
                  </View>
                  {setFailure?.setId === set.id && (
                    <View style={styles.failure}>
                      <ErrorAlert message={setFailure.message} />
                      <Button ref={(node) => { if (node) retryRefs.current.set(set.id, node); }} title="Prøv igjen" variant="secondary" onPress={setFailure.retry} />
                    </View>
                  )}
                </FormSection>
              );
            })())}
            {expanded && (
              <View style={styles.exerciseActions}>
                <CompactAction
                  disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined || hasUnsavedDraft}
                  busy={pendingExerciseOperation === 'add-set'}
                  icon="+"
                  label={pendingExerciseOperation === 'add-set' ? 'Legger til sett' : 'Legg til sett'}
                  onPress={() => void flushDrafts().then((saved) => {
                    if (saved) void addSet(state.workout.id, exercise.id, exercise.name);
                  })}
                />
                <CompactAction
                  accessibilityLabel={`Fjern ${exercise.name} fra økten`}
                  disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined}
                  icon="×"
                  label="Fjern øvelse"
                  onPress={() => {
                    if (completed > 0) setRemoveExerciseId(exercise.id);
                    else void removeExercise(state.workout.id, exercise.id, exercise.name);
                  }}
                  ref={(node) => { if (node) removeExerciseRefs.current.set(exercise.id, node); }}
                />
              </View>
            )}
            {exerciseFailure?.workoutExerciseId === exercise.id && (
              <View style={styles.failure}>
                <ErrorAlert message={exerciseFailure.message} />
                <Button ref={(node) => { if (node) exerciseRetryRefs.current.set(exercise.id, node); }} title="Prøv igjen" variant="secondary" onPress={() => {
                  if (exerciseFailure.operation === 'add-set') void addSet(state.workout.id, exercise.id, exercise.name);
                  else void removeExercise(state.workout.id, exercise.id, exercise.name);
                }} />
              </View>
            )}
          </DisclosureCard>
        );
      })}
      <Button
        ref={addExerciseRef}
        disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined || hasUnsavedDraft}
        title="Legg til øvelse"
        variant="secondary"
        onPress={() => void flushDrafts().then((saved) => { if (saved) {
          navigation.setParams({ focusAddExercise: true });
          navigation.navigate('ExercisePicker', { workoutId: state.workout.id });
        } })}
      />
      <Button
        ref={completeRef}
        disabled={!hasCompletedSet || workoutBusy || hasDirtyDraft || hasUnsavedDraft}
        title="Ferdig"
        onPress={() => { setCompleteFailed(false); setCompleteDialogOpen(true); }}
      />
      {completeFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke fullføre økten" />
          <Button ref={retryCompleteRef} title="Prøv igjen" variant="secondary" onPress={() => setCompleteDialogOpen(true)} />
        </View>
      )}
      <Button ref={cancelRef} disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined} title="Avbryt" variant="text" onPress={() => {
        setCancelFailed(false);
        setCancelDialogOpen(true);
      }} />
      {cancelFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke avbryte økten" />
          <Button ref={retryCancelRef} title="Prøv igjen" variant="secondary" onPress={() => setCancelDialogOpen(true)} />
        </View>
      )}
      {removeExerciseId !== undefined && (
        <Dialog
          onRequestClose={closeRemoveDialog}
          visible
          initialFocusRef={confirmRemoveRef}
          title="Fjern øvelsen?"
        >
          <Text style={{ color: colors.text }}>Gjennomførte og planlagte sett for øvelsen fjernes fra denne økten.</Text>
          <Button disabled={pendingExerciseOperation === 'remove-exercise'} title="Behold øvelsen" variant="secondary" onPress={closeRemoveDialog} />
          <Button
            accessibilityLabel="Bekreft fjerning av øvelsen"
            ref={confirmRemoveRef}
            busy={pendingExerciseOperation === 'remove-exercise'}
            disabled={pendingExerciseOperation === 'remove-exercise'}
            title={pendingExerciseOperation === 'remove-exercise' ? 'Fjerner øvelse' : 'Fjern øvelse'}
            variant="destructive"
            onPress={() => {
              const exercise = state.workout.exercises.find((candidate) => candidate.id === removeExerciseId);
              if (exercise) void removeExercise(state.workout.id, exercise.id, exercise.name);
            }}
          />
        </Dialog>
      )}
      {completeDialogOpen && (
        <Dialog
          onRequestClose={() => {
            if (!completing) { setCompleteDialogOpen(false); requestAnimationFrame(() => focus(completeRef)); }
          }}
          visible
          initialFocusRef={confirmCompleteRef}
          title="Fullfør økten?"
        >
          <Text style={{ color: colors.text }}>Økten lagres i historikken.</Text>
          {hasPlannedSet && <Text style={{ color: colors.text }}>Det er sett som ikke er bekreftet. Disse vil bli forkastet om du fortsetter.</Text>}
          <Button disabled={completing} title="Fortsett økten" variant="secondary" onPress={() => {
            setCompleteDialogOpen(false);
            requestAnimationFrame(() => focus(completeRef));
          }} />
          <Button ref={confirmCompleteRef} busy={completing} disabled={completing} title={completing ? 'Fullfører' : 'Fullfør økt'} onPress={() => void confirmCompletion(state.workout.id)} />
        </Dialog>
      )}
      <Dialog
        onRequestClose={closeCancelDialog}
        visible={cancelDialogOpen}
        initialFocusRef={confirmCancelRef}
        title="Avbryt økten?"
      >
        <Text style={{ color: colors.text }}>Økten slettes permanent og vises ikke i historikken.</Text>
        <Button disabled={cancelling} title="Behold økten" variant="secondary" onPress={closeCancelDialog} />
        <Button ref={confirmCancelRef} busy={cancelling} disabled={cancelling} title={cancelling ? 'Avbryter' : 'Avbryt økten'} variant="destructive" onPress={() => void confirmCancellation(state.workout.id)} />
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  empty: { fontSize: 18, paddingVertical: 36, textAlign: 'center' },
  fields: { gap: 10 },
  receipt: { alignItems: 'stretch', borderBottomWidth: 1, gap: 12, paddingBottom: 12 },
  receiptTitle: { fontSize: 16, fontWeight: '600' },
  receiptText: { flex: 1, gap: 4 },
  setActions: { gap: 10 },
  exerciseActions: { gap: 10 },
  failure: { gap: 10 },
});
