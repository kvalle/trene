import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  findNodeHandle,
  Keyboard,
  LayoutAnimation,
  Platform,
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
  deleteCompletedWorkoutSet,
  deletePlannedWorkoutSet,
  loadActiveWorkout,
  removeExerciseFromWorkout,
  saveCompletedWorkoutSet,
  savePlannedWorkoutSet,
  unconfirmWorkoutSet,
  type ActiveWorkout,
  type WorkoutSet,
} from '../database/workouts';
import { parseLoad, parseRepetitions, validateWorkoutSet } from '../domain/workoutSet';
import { formatDateTime, formatLoad } from '../locale';
import { typography } from '../theme';
import { Button } from '../ui/Button';
import { useAppTheme } from '../ui/AppThemeProvider';
import { CompactAction } from '../ui/CompactAction';
import { Dialog } from '../ui/Dialog';
import { DisclosureCard } from '../ui/DisclosureCard';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Icon } from '../ui/Icon';
import { Loader } from '../ui/Loader';
import { NumericField } from '../ui/NumericField';
import { PageStatus } from '../ui/PageStatus';
import { type WorkoutSetDraft, useWorkoutSetDrafts } from '../workoutSetDrafts';
import { useActiveWorkoutVisibility } from '../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; workout: ActiveWorkout };
function isDirty(set: WorkoutSet, draft?: WorkoutSetDraft): boolean {
  if (!draft) return false;
  const persistedLoad = set.loadKg === null ? '' : formatLoad(set.loadKg);
  const persistedRepetitions = set.repetitions?.toString() ?? '';
  return draft.load !== persistedLoad || draft.repetitions !== persistedRepetitions;
}

export function WorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const { drafts, setDrafts } = useWorkoutSetDrafts();
  const { reconcile } = useActiveWorkoutVisibility();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [expandedIds, setExpandedIds] = useState(() => route.params?.focusExerciseId
    ? new Set([route.params.focusExerciseId])
    : new Set<number>());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [removeExerciseId, setRemoveExerciseId] = useState<number>();
  const [removeCompletedSetId, setRemoveCompletedSetId] = useState<number>();
  const [editingSetId, setEditingSetId] = useState<number>();
  const [focusSetId, setFocusSetId] = useState<number>();
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
  const [reduceMotion, setReduceMotion] = useState(true);
  const addExerciseRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  const completeRef = useRef<View>(null);
  const confirmCompleteRef = useRef<View>(null);
  const retryCompleteRef = useRef<View>(null);
  const confirmCancelRef = useRef<View>(null);
  const retryCancelRef = useRef<View>(null);
  const confirmRemoveRef = useRef<View>(null);
  const confirmRemoveSetRef = useRef<View>(null);
  const removeExerciseRefs = useRef(new Map<number, View>());
  const exerciseRetryRefs = useRef(new Map<number, View>());
  const allowNavigation = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const lifecycleFlush = useRef(Promise.resolve(true));
  const saveQueueFailed = useRef(false);
  const pendingSaves = useRef(0);
  const pendingBlurSaves = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const cardRefs = useRef(new Map<number, View>());
  const loadInputRefs = useRef(new Map<number, TextInput>());
  const repetitionsInputRefs = useRef(new Map<number, TextInput>());
  const retryRefs = useRef(new Map<number, View>());
  const rowRefs = useRef(new Map<number, View>());
  const editRefs = useRef(new Map<number, View>());
  const removeSetRefs = useRef(new Map<number, View>());
  const addSetRefs = useRef(new Map<number, View>());

  useFocusEffect(useCallback(() => {
    let active = true;
    loadActiveWorkout(database).then(
      (workout) => {
        if (!active) return;
        if (!workout) setState({ status: 'failed' });
        else {
          setState({ status: 'ready', workout });
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
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const focusExerciseId = route.params?.focusExerciseId;
    if (focusExerciseId && !expandedIds.has(focusExerciseId)) {
      setExpandedIds((current) => new Set(current).add(focusExerciseId));
    }
    const target = route.params?.focusExerciseId
      ? cardRefs.current.get(route.params.focusExerciseId)
      : route.params?.focusAddExercise ? addExerciseRef.current : null;
    const handle = target && findNodeHandle(target);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    if (target) navigation.setParams({ focusExerciseId: undefined, focusAddExercise: undefined });
  }, [expandedIds, navigation, route.params, state]);

  const hasDirtyDraft = state.status === 'ready' && state.workout.exercises.some((exercise) =>
    exercise.sets.some((set) => isDirty(
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

  useEffect(() => () => {
    pendingBlurSaves.current.forEach(clearTimeout);
    pendingBlurSaves.current.clear();
  }, []);

  useEffect(() => {
    if (!setRetryFocus) return;
    focus({ current: retryRefs.current.get(setRetryFocus.setId) ?? null });
  }, [setRetryFocus]);

  useEffect(() => {
    if (focusSetId === undefined) return;
    focus({ current: rowRefs.current.get(focusSetId) ?? null });
    setFocusSetId(undefined);
  }, [focusSetId, state]);

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

  function closeRemoveSetDialog() {
    if (pendingSetId !== undefined) return;
    const setId = removeCompletedSetId;
    setRemoveCompletedSetId(undefined);
    if (setFailure?.setId === setId) setSetFailure(undefined);
    requestAnimationFrame(() => focus({ current: setId ? removeSetRefs.current.get(setId) ?? null : null }));
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
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
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
          }),
        })),
      },
    }));
  }

  function updateWorkoutExercise(workoutExerciseId: number, update: (sets: WorkoutSet[]) => WorkoutSet[] | null) {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
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
        if (set.confirmedAt) {
          if (loadValue === null || repetitionsValue === null) return false;
          await saveCompletedWorkoutSet(database, workoutId, set.id, loadValue, repetitionsValue);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await savePlannedWorkoutSet(database, workoutId, set.id, loadValue, repetitionsValue);
        }
        saveQueueFailed.current = false;
        updateDraft(set, { unsaved: false });
        updateWorkoutSet(set.id, (current) => ({ ...current, loadKg: loadValue, repetitions: repetitionsValue }));
        return true;
      } catch {
        saveQueueFailed.current = true;
        updateDraft(set, { unsaved: true });
        AccessibilityInfo.announceForAccessibility(`Endringene for ${exerciseName} er ikke lagret.`);
        if (set.confirmedAt) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    pendingBlurSaves.current.forEach(clearTimeout);
    pendingBlurSaves.current.clear();
    for (const exercise of state.workout.exercises) {
      for (const set of exercise.sets) {
        const draft = drafts[set.id]?.workoutId === state.workout.id ? drafts[set.id] : undefined;
        if (isDirty(set, draft) && !draft?.unsaved) {
          if (!await saveDraft(state.workout.id, set, exercise.name, draft)) return false;
        }
      }
    }
    return true;
  }

  function validateCompleteDraft(set: WorkoutSet): boolean {
    const validation = validateWorkoutSet(draftFor(set).load, draftFor(set).repetitions);
    if ('loadKg' in validation) return true;
    updateDraft(set, validation);
    AccessibilityInfo.announceForAccessibility('Kontroller belastning og repetisjoner.');
    const invalidInput = validation.loadError
      ? loadInputRefs.current.get(set.id)
      : repetitionsInputRefs.current.get(set.id);
    const exerciseId = state.status === 'ready'
      ? state.workout.exercises.find((exercise) => exercise.sets.some((candidate) => candidate.id === set.id))?.exerciseId
      : undefined;
    if (exerciseId !== undefined) setExpandedIds((current) => new Set(current).add(exerciseId));
    requestAnimationFrame(() => focus({ current: invalidInput ?? null }));
    return false;
  }

  async function leaveEditor(nextSetId?: number, returnFocus = false): Promise<boolean> {
    if (state.status !== 'ready' || editingSetId === undefined) return true;
    const current = state.workout.exercises.flatMap((exercise) => exercise.sets)
      .find((set) => set.id === editingSetId);
    if (!current || !validateCompleteDraft(current)) return false;
    const exercise = state.workout.exercises.find((candidate) => candidate.sets.some((set) => set.id === current.id));
    if (!exercise || !await saveDraft(state.workout.id, current, exercise.name)) return false;
    setEditingSetId(nextSetId);
    if (nextSetId === undefined) Keyboard.dismiss();
    requestAnimationFrame(() => {
      if (nextSetId !== undefined) loadInputRefs.current.get(nextSetId)?.focus();
      else if (returnFocus) focus({ current: editRefs.current.get(current.id) ?? null });
    });
    return true;
  }

  async function openEditor(setId: number) {
    if (editingSetId === setId) return;
    if (editingSetId !== undefined && !await leaveEditor(setId)) return;
    if (editingSetId === undefined) setEditingSetId(setId);
    requestAnimationFrame(() => loadInputRefs.current.get(setId)?.focus());
  }

  function saveOnBlur(workoutId: number, set: WorkoutSet, exerciseName: string) {
    const existing = pendingBlurSaves.current.get(set.id);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      pendingBlurSaves.current.delete(set.id);
      void saveDraft(workoutId, set, exerciseName);
    }, 100);
    pendingBlurSaves.current.set(set.id, timeout);
  }

  function runEditorAction(action: () => void) {
    if (editingSetId !== undefined) {
      const pending = pendingBlurSaves.current.get(editingSetId);
      if (pending) clearTimeout(pending);
      pendingBlurSaves.current.delete(editingSetId);
    }
    action();
  }

  async function confirmSet(workoutId: number, set: WorkoutSet, exerciseName: string) {
    const draft = draftFor(set);
    const validation = validateWorkoutSet(draft.load, draft.repetitions);
    if (!('loadKg' in validation)) {
      setEditingSetId(set.id);
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
      AccessibilityInfo.announceForAccessibility(`Sett gjennomført for ${exerciseName}.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      requestAnimationFrame(() => focus({ current: rowRefs.current.get(set.id) ?? null }));
    } catch {
      updateDraft(set, { confirmationFailed: true });
      AccessibilityInfo.announceForAccessibility('Kunne ikke bekrefte settet. Prøv igjen.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSetRetryFocus({ setId: set.id });
    } finally {
      setPendingSetId(undefined);
    }
  }

  async function changeSetStatus(set: WorkoutSet, exerciseName: string) {
    if (state.status !== 'ready') return;
    const workout = state.workout;
    if (editingSetId !== undefined) {
      const editingSet = workout.exercises.flatMap((exercise) => exercise.sets)
        .find((candidate) => candidate.id === editingSetId);
      const editingExercise = workout.exercises
        .find((exercise) => exercise.sets.some((candidate) => candidate.id === editingSetId));
      if (!editingSet || !editingExercise || !validateCompleteDraft(editingSet)
        || !await saveDraft(workout.id, editingSet, editingExercise.name)) return;
    }
    if (set.confirmedAt === null) {
      await confirmSet(workout.id, set, exerciseName);
      return;
    }
    void mutateSet(
      set.id,
      () => unconfirmWorkoutSet(database, workout.id, set.id),
      (current) => ({ ...current, confirmedAt: null }),
      'Kunne ikke endre settet til planlagt. Prøv igjen.',
      false,
      `Sett endret til planlagt for ${exerciseName}.`,
      () => {
        requestAnimationFrame(() => focus({ current: rowRefs.current.get(set.id) ?? null }));
      },
    );
  }

  function focusAfterSetRemoval(sets: WorkoutSet[], index: number, workoutExerciseId: number) {
    const targetId = sets[index - 1]?.id ?? sets[index + 1]?.id;
    requestAnimationFrame(() => focus({
      current: targetId !== undefined
        ? rowRefs.current.get(targetId) ?? null
        : addSetRefs.current.get(workoutExerciseId) ?? null,
    }));
  }

  async function mutateSet(
    setId: number,
    operation: () => Promise<void>,
    apply: (set: WorkoutSet) => WorkoutSet | null,
    failure: string,
    removeDraft = false,
    success?: string,
    focusAfter?: () => void,
    failureRetry?: () => void,
    onFailure?: () => void,
  ) {
    setPendingSetId(setId);
    setSetFailure(undefined);
    try {
      await operation();
      updateWorkoutSet(setId, apply);
      if (removeDraft) {
        setDrafts((current) => { const next = { ...current }; delete next[setId]; return next; });
      }
      if (success) {
        AccessibilityInfo.announceForAccessibility(success);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      focusAfter?.();
    } catch {
      onFailure?.();
      AccessibilityInfo.announceForAccessibility(failure);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSetFailure({
        setId,
        message: failure,
        retry: failureRetry ?? (() => void mutateSet(setId, operation, apply, failure, removeDraft, success, focusAfter)),
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
      void reconcile();
      setDrafts({});
      setCancelDialogOpen(false);
      allowNavigation.current = true;
      navigation.popTo('Home', { focusStartWorkout: true });
    } catch {
      setCancelDialogOpen(false);
      setCancelFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke avbryte treningen. Prøv igjen.');
    } finally {
      setCancelling(false);
    }
  }

  async function confirmCompletion(workoutId: number) {
    setCompleting(true);
    setCompleteFailed(false);
    try {
      await completeWorkout(database, workoutId);
      void reconcile();
      setDrafts({});
      setCompleteDialogOpen(false);
      allowNavigation.current = true;
      navigation.replace('CompletedWorkout', { workoutId, fromCompletion: true });
    } catch {
      setCompleteDialogOpen(false);
      setCompleteFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke fullføre treningen. Prøv igjen.');
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
      updateWorkoutExercise(workoutExerciseId, (sets) => [...sets, set]);
      AccessibilityInfo.announceForAccessibility(`Nytt planlagt sett lagt til for ${exerciseName}.`);
      void Haptics.selectionAsync();
      setFocusSetId(set.id);
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
      const exerciseId = state.status === 'ready'
        ? state.workout.exercises.find((exercise) => exercise.id === workoutExerciseId)?.exerciseId
        : undefined;
      if (exerciseId) {
        setExpandedIds((current) => {
          const next = new Set(current);
          next.delete(exerciseId);
          return next;
        });
      }
      AccessibilityInfo.announceForAccessibility(`${exerciseName} fjernet fra treningen.`);
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
    <ScrollView
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[typography.metadata, { color: colors.muted }]}>
        Startet {formatDateTime(new Date(state.workout.startedAt))}
      </Text>
      {state.workout.exercises.length === 0 && (
        <Text style={[typography.body, styles.empty, { color: colors.text }]}>Ingen øvelser lagt til ennå</Text>
      )}
      {state.workout.exercises.map((exercise) => {
        const expanded = expandedIds.has(exercise.exerciseId);
        const completed = exercise.sets.filter((set) => set.confirmedAt !== null).length;
        const exerciseCompleted = exercise.sets.length > 0 && completed === exercise.sets.length;
        const summary = `${completed} av ${exercise.sets.length} sett gjennomført`;
        return (
          <DisclosureCard
            key={exercise.id}
            accessibilityLabel={`${exercise.name}, ${summary}, ${exerciseCompleted ? 'fullført' : 'ikke fullført'}`}
            expanded={expanded}
            headerRef={(node) => { if (node) cardRefs.current.set(exercise.exerciseId, node); }}
            onPress={() => setExpandedIds((current) => {
              const next = new Set(current);
              if (expanded) next.delete(exercise.exerciseId);
              else next.add(exercise.exerciseId);
              return next;
            })}
            leading={(
              <View
                accessible={false}
                testID={`workout-exercise-${exercise.id}-completion`}
                style={[
                  styles.exerciseStatus,
                  {
                    backgroundColor: exerciseCompleted ? colors.secondary : colors.surfaceAlt,
                    borderColor: exerciseCompleted ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon color={exerciseCompleted ? colors.primary : colors.muted} name={exerciseCompleted ? 'check' : 'hourglass'} size={16} testID={`workout-exercise-${exercise.id}-completion-icon-${exerciseCompleted ? 'check' : 'hourglass'}`} />
              </View>
            )}
            summary={summary}
            title={exercise.name}
          >
            {expanded && (
              <CompactAction
                accessibilityLabel={`Fjern ${exercise.name} fra treningen`}
                disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined}
                icon="trash"
                label="Fjern øvelse"
                tone="destructive"
                onPress={() => {
                  if (completed > 0) setRemoveExerciseId(exercise.id);
                  else void removeExercise(state.workout.id, exercise.id, exercise.name);
                }}
                ref={(node) => { if (node) removeExerciseRefs.current.set(exercise.id, node); }}
              />
            )}
            {exercise.sets.map((set, index) => {
              const draft = draftFor(set);
              const busy = pendingSetId === set.id;
              const editing = editingSetId === set.id;
              const completedSet = set.confirmedAt !== null;
              const status = completedSet ? 'Gjennomført' : 'Planlagt';
              return (
                <View key={set.id} style={[styles.setContainer, { borderColor: colors.border }]}>
                  <View style={styles.setRow}>
                    <View
                      accessible
                      accessibilityLabel={`Sett ${index + 1}, ${set.loadKg === null ? 'belastning ikke angitt' : `${formatLoad(set.loadKg)} kilogram`}, ${set.repetitions === null ? 'repetisjoner ikke angitt' : `${set.repetitions} repetisjoner`}, ${status}`}
                      ref={(node) => { if (node) rowRefs.current.set(set.id, node); }}
                      style={styles.setCopy}
                    >
                      <View style={[
                        styles.setNumber,
                        { backgroundColor: completedSet ? colors.secondary : colors.surfaceAlt, borderColor: completedSet ? colors.primary : colors.border },
                      ]}>
                        <Text style={[typography.control, { color: completedSet ? colors.onSecondary : colors.text }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.setSummary}>
                        <Text style={[typography.body, { color: colors.text }]}>{set.loadKg === null ? '–' : formatLoad(set.loadKg)} kg · {set.repetitions ?? '–'} repetisjoner</Text>
                        <View style={styles.status}>
                          <Icon color={completedSet ? colors.primary : colors.muted} name={completedSet ? 'check' : 'hourglass'} size={16} />
                          <Text style={[typography.metadata, { color: completedSet ? colors.primary : colors.muted }]}>{status}</Text>
                        </View>
                      </View>
                    </View>
                    <View accessible={false} style={styles.rowActions}>
                      <Button
                        accessibilityLabel={`${editing ? 'Lukk redigering av' : 'Rediger'} sett ${index + 1} for ${exercise.name}`}
                        disabled={workoutBusy}
                        icon={editing ? 'chevron-up' : 'edit'}
                        ref={(node) => { if (node) editRefs.current.set(set.id, node); }}
                        variant="secondary"
                        onPress={() => runEditorAction(() => editing ? void leaveEditor(undefined, true) : void openEditor(set.id))}
                      />
                      <Button
                        accessibilityLabel={completedSet ? `Endre sett ${index + 1} til planlagt for ${exercise.name}` : `Marker sett ${index + 1} som gjennomført for ${exercise.name}`}
                        disabled={workoutBusy}
                        icon={completedSet ? 'hourglass' : 'check'}
                        variant="secondary"
                        onPress={() => runEditorAction(() => void changeSetStatus(set, exercise.name))}
                      />
                    </View>
                  </View>
                  {editing && <View style={styles.editor}>
                  <View accessibilityLabel={`Handlinger for sett ${index + 1} for ${exercise.name}`} style={styles.setActions}>
                    <CompactAction
                      accessibilityLabel={`Fjern sett ${index + 1} for ${exercise.name}`}
                      disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined}
                      icon="trash"
                      label="Fjern sett"
                      ref={(node) => { if (node) removeSetRefs.current.set(set.id, node); }}
                      tone={completedSet ? 'destructive' : 'neutral'}
                      onPress={() => runEditorAction(() => {
                        if (completedSet) {
                          setSetFailure(undefined);
                          Keyboard.dismiss();
                          setRemoveCompletedSetId(set.id);
                        }
                        else void mutateSet(
                          set.id,
                          () => deletePlannedWorkoutSet(database, state.workout.id, set.id),
                          () => null,
                          'Kunne ikke slette settet. Prøv igjen.',
                          true,
                          undefined,
                          () => { setEditingSetId(undefined); focusAfterSetRemoval(exercise.sets, index, exercise.id); },
                        );
                      })}
                    />
                  </View>
                    <View style={styles.fields}>
                    <NumericField
                        aria-describedby={draft.loadError ? `load-error-${set.id}` : undefined}
                        aria-invalid={Boolean(draft.loadError)}
                        accessibilityLabel={`Belastning for ${exercise.name}`}
                        error={draft.loadError}
                        errorID={`load-error-${set.id}`}
                        kind="decimal"
                        label="Belastning"
                        containerStyle={styles.field}
                        onBlur={() => saveOnBlur(state.workout.id, set, exercise.name)}
                        onChangeText={(load) => updateDraft(set, { load, loadError: undefined })}
                        placeholder="Belastning"
                        ref={(node) => { if (node) loadInputRefs.current.set(set.id, node); }}
                        testID={`workout-set-${set.id}-load`}
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
                        containerStyle={styles.field}
                        onBlur={() => saveOnBlur(state.workout.id, set, exercise.name)}
                        onChangeText={(repetitions) => updateDraft(set, { repetitions, repetitionsError: undefined })}
                        placeholder="Repetisjoner"
                        ref={(node) => { if (node) repetitionsInputRefs.current.set(set.id, node); }}
                        testID={`workout-set-${set.id}-repetitions`}
                        value={draft.repetitions}
                    />
                    </View>
                  {busy && <Loader label="Lagrer endringer" size="compact" />}
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
                  {setFailure?.setId === set.id && (
                    <View style={styles.failure}>
                      <ErrorAlert message={setFailure.message} />
                      <Button ref={(node) => { if (node) retryRefs.current.set(set.id, node); }} title="Prøv igjen" variant="secondary" onPress={setFailure.retry} />
                    </View>
                  )}
                  </View>}
                  {setFailure?.setId === set.id && !editing && (
                    <View style={styles.failure}>
                      <ErrorAlert message={setFailure.message} />
                      <Button ref={(node) => { if (node) retryRefs.current.set(set.id, node); }} title="Prøv igjen" variant="secondary" onPress={setFailure.retry} />
                    </View>
                  )}
                </View>
              );
            })}
            {expanded && (
              <View style={styles.exerciseActions}>
                <CompactAction
                  ref={(node) => { if (node) addSetRefs.current.set(exercise.id, node); }}
                  disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined || hasUnsavedDraft}
                  busy={pendingExerciseOperation === 'add-set'}
                  icon="plus"
                  label={pendingExerciseOperation === 'add-set' ? 'Legger til sett' : 'Legg til sett'}
                  onPress={() => void flushDrafts().then((saved) => {
                    if (saved) void addSet(state.workout.id, exercise.id, exercise.name);
                  })}
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
        variant={state.workout.exercises.length === 0 ? 'primary' : 'secondary'}
        onPress={() => void flushDrafts().then((saved) => { if (saved) {
          navigation.setParams({ focusAddExercise: true });
          navigation.navigate('ExercisePicker', { workoutId: state.workout.id });
        } })}
      />
      {state.workout.exercises.length > 0 && (
        <Button
          ref={completeRef}
          disabled={!hasCompletedSet || workoutBusy || hasDirtyDraft || hasUnsavedDraft}
          title="Ferdig"
          onPress={() => { setCompleteFailed(false); setCompleteDialogOpen(true); }}
        />
      )}
      {completeFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke fullføre treningen" />
          <Button ref={retryCompleteRef} title="Prøv igjen" variant="secondary" onPress={() => setCompleteDialogOpen(true)} />
        </View>
      )}
      {state.workout.exercises.length === 0 ? (
        <Button ref={cancelRef} disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined} title="Avbryt" variant="text" testID="cancel-active-workout" onPress={() => {
          setCancelFailed(false);
          setCancelDialogOpen(true);
        }} />
      ) : (
        <Button ref={cancelRef} disabled={pendingSetId !== undefined || pendingExerciseOperation !== undefined} testID="cancel-active-workout" title="Avbryt" variant="text" onPress={() => {
          setCancelFailed(false);
          setCancelDialogOpen(true);
        }} />
      )}
      {cancelFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke avbryte treningen" />
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
          <Text style={[typography.body, { color: colors.text }]}>Gjennomførte og planlagte sett for øvelsen fjernes fra denne treningen.</Text>
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
      {removeCompletedSetId !== undefined && (
        <Dialog
          onRequestClose={closeRemoveSetDialog}
          visible
          initialFocusRef={confirmRemoveSetRef}
          title="Fjern gjennomført sett?"
        >
          <Text style={[typography.body, { color: colors.text }]}>Det gjennomførte settet fjernes permanent fra treningen.</Text>
          {setFailure?.setId === removeCompletedSetId && (
            <View style={styles.failure}>
              <ErrorAlert message={setFailure.message} />
              <Button
                ref={(node) => { if (node) retryRefs.current.set(removeCompletedSetId, node); }}
                title="Prøv igjen"
                variant="secondary"
                onPress={setFailure.retry}
              />
            </View>
          )}
          <Button disabled={pendingSetId !== undefined} title="Behold settet" variant="secondary" onPress={closeRemoveSetDialog} />
          <Button
            accessibilityLabel="Bekreft fjerning av gjennomført sett"
            ref={confirmRemoveSetRef}
            busy={pendingSetId === removeCompletedSetId}
            disabled={pendingSetId !== undefined}
            title={pendingSetId === removeCompletedSetId ? 'Fjerner sett' : 'Fjern sett'}
            variant="destructive"
            onPress={() => {
              const exercise = state.workout.exercises.find((candidate) => candidate.sets.some((set) => set.id === removeCompletedSetId));
              const index = exercise?.sets.findIndex((set) => set.id === removeCompletedSetId) ?? -1;
              if (!exercise || index < 0) return;
              const setId = removeCompletedSetId;
              void mutateSet(
                setId,
                async () => {
                  await deleteCompletedWorkoutSet(database, state.workout.id, setId);
                  // Keep the native focus launcher mounted until the modal has closed.
                  setRemoveCompletedSetId(undefined);
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                },
                () => null,
                'Kunne ikke fjerne det gjennomførte settet. Prøv igjen.',
                true,
                'Gjennomført sett fjernet.',
                () => {
                  setEditingSetId(undefined);
                  focusAfterSetRemoval(exercise.sets, index, exercise.id);
                },
                () => {
                  setSetFailure(undefined);
                  setRemoveCompletedSetId(setId);
                },
                () => setRemoveCompletedSetId(undefined),
              );
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
          title="Fullfør treningen?"
        >
          <Text style={[typography.body, { color: colors.text }]}>Treningen lagres i historikken.</Text>
          {hasPlannedSet && <Text style={[typography.body, { color: colors.danger }]}>Det er sett som ikke er bekreftet. Disse vil bli forkastet om du fortsetter.</Text>}
          <Button disabled={completing} title="Fortsett treningen" variant="secondary" onPress={() => {
            setCompleteDialogOpen(false);
            requestAnimationFrame(() => focus(completeRef));
          }} />
          <Button ref={confirmCompleteRef} busy={completing} disabled={completing} title={completing ? 'Fullfører' : 'Fullfør trening'} onPress={() => void confirmCompletion(state.workout.id)} />
        </Dialog>
      )}
      <Dialog
        onRequestClose={closeCancelDialog}
        visible={cancelDialogOpen}
        initialFocusRef={confirmCancelRef}
        title="Avbryt treningen?"
      >
        <Text style={[typography.body, { color: colors.text }]}>Treningen slettes permanent og vises ikke i historikken.</Text>
        <Button disabled={cancelling} title="Behold treningen" variant="secondary" onPress={closeCancelDialog} />
        <Button ref={confirmCancelRef} busy={cancelling} disabled={cancelling} title={cancelling ? 'Avbryter' : 'Avbryt treningen'} variant="destructive" onPress={() => void confirmCancellation(state.workout.id)} />
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  empty: { paddingVertical: 36, textAlign: 'center' },
  exerciseStatus: { alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  setContainer: { borderBottomWidth: 1, paddingBottom: 12 },
  setRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 48 },
  setCopy: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 100 },
  setNumber: { alignItems: 'center', borderRadius: 24, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  setSummary: { flex: 1, gap: 2, minWidth: 100 },
  status: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  rowActions: { flexDirection: 'row', gap: 8 },
  editor: { gap: 12, marginLeft: 50, paddingTop: 12 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexBasis: 120, flexGrow: 1 },
  setActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  exerciseActions: { gap: 10 },
  failure: { gap: 10 },
});
