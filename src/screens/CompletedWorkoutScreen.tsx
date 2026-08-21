import { usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { deleteCompletedWorkout, loadCompletedWorkout, type CompletedWorkout } from '../database/workouts';
import { formatDateTime, formatLoad } from '../locale';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletedWorkout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'missing' } | { status: 'ready'; workout: CompletedWorkout };

export function CompletedWorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const retryRef = useRef<View>(null);
  const deleteRef = useRef<View>(null);
  const confirmDeleteRef = useRef<View>(null);
  const allowNavigation = useRef(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  usePreventRemove(Boolean(route.params.fromCompletion) || deleting, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
    else if (deleting) return;
    else {
      allowNavigation.current = true;
      navigation.popTo('Home', { focusStartWorkout: true });
    }
  });

  useEffect(() => {
    let active = true;
    loadCompletedWorkout(database, route.params.workoutId).then(
      (workout) => {
        if (!active) return;
        setState(workout ? { status: 'ready', workout } : { status: 'missing' });
      },
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.workoutId]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  useEffect(() => {
    if (deleteFailed) focus(retryRef);
  }, [deleteFailed]);

  function focus(target: React.RefObject<View | null>) {
    const handle = findNodeHandle(target.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    requestAnimationFrame(() => focus(deleteRef));
  }

  async function confirmDeletion(workoutId: number) {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      const result = await deleteCompletedWorkout(database, workoutId);
      allowNavigation.current = true;
      const params = result.focusWorkoutId === null
        ? { focusEmptyAction: true }
        : { focusWorkoutId: result.focusWorkoutId };
      if (route.params.fromCompletion) navigation.replace('History', params);
      else navigation.popTo('History', params);
    } catch {
      setDeleteDialogOpen(false);
      setDeleteFailed(true);
      AccessibilityInfo.announceForAccessibility('Kunne ikke slette økten. Prøv igjen.');
    } finally {
      setDeleting(false);
    }
  }

  if (state.status === 'loading') {
    return <ActivityIndicator accessibilityLabel="Laster fullført økt" style={styles.center} />;
  }
  if (state.status === 'failed') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Kunne ikke laste inn</Text>
      <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke laste inn den fullførte økten.</Text>
      <Action actionRef={retryRef} label="Prøv igjen" onPress={() => { setState({ status: 'loading' }); setReload((value) => value + 1); }} />
    </View>
  );
  if (state.status === 'missing') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Finnes ikke lenger</Text>
      <Action label={route.params.fromCompletion ? 'Tilbake til forsiden' : 'Tilbake til tidligere økter'} onPress={() => {
        allowNavigation.current = true;
        if (route.params.fromCompletion) navigation.popTo('Home', { focusStartWorkout: true });
        else navigation.popTo('History');
      }} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Fullført økt</Text>
      <Text style={[styles.completedAt, { color: colors.text }]}>
        {formatDateTime(new Date(state.workout.completedAt))}
      </Text>
      {state.workout.exercises.map((exercise) => (
        <View key={exercise.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.exerciseTitle, { color: colors.text }]}>{exercise.name}</Text>
          {exercise.sets.map((set, index) => (
            <View
              accessible
              accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg!)} kilogram`}
              key={set.id}
              style={[styles.set, { borderColor: colors.border }]}
            >
              <Text style={[styles.setTitle, { color: colors.text }]}>Sett {index + 1}</Text>
              <Text style={{ color: colors.text }}>{formatLoad(set.loadKg!)} kg · {set.repetitions} repetisjoner</Text>
            </View>
          ))}
        </View>
      ))}
      <Action actionRef={deleteRef} destructive label="Slett økt" onPress={() => {
        setDeleteFailed(false);
        setDeleteDialogOpen(true);
      }} />
      {deleteFailed && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke slette økten</Text>
          <Action actionRef={retryRef} label="Prøv igjen" onPress={() => setDeleteDialogOpen(true)} />
        </View>
      )}
      {route.params.fromCompletion && (
        <Action label="Tilbake til forsiden" onPress={() => {
          allowNavigation.current = true;
          navigation.popTo('Home', { focusStartWorkout: true });
        }} />
      )}
      <Modal
        animationType="none"
        onRequestClose={closeDeleteDialog}
        onShow={() => focus(confirmDeleteRef)}
        transparent
        visible={deleteDialogOpen}
      >
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text accessibilityRole="header" style={[styles.dialogTitle, { color: colors.text }]}>Slett fullført økt?</Text>
            <Text style={{ color: colors.text }}>Den fullførte økten slettes permanent. Dette kan ikke angres.</Text>
            <Action disabled={deleting} label="Avbryt" onPress={closeDeleteDialog} />
            <Action
              actionRef={confirmDeleteRef}
              destructive
              disabled={deleting}
              label={deleting ? 'Sletter økt' : 'Slett'}
              onPress={() => void confirmDeletion(state.workout.id)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Action({ actionRef, destructive = false, disabled = false, label, onPress }: {
  actionRef?: React.RefObject<View | null>; destructive?: boolean; disabled?: boolean; label: string; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      ref={actionRef}
      style={[styles.button, { backgroundColor: destructive ? colors.notification : colors.primary }, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  completedAt: { fontSize: 17, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  exerciseTitle: { fontSize: 21, fontWeight: '700' },
  set: { borderTopWidth: 1, gap: 4, paddingTop: 12 },
  setTitle: { fontSize: 16, fontWeight: '600' },
  button: { alignItems: 'center', borderRadius: 13, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  failure: { gap: 10 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 16, gap: 16, maxWidth: 440, padding: 24, width: '100%' },
  dialogTitle: { fontSize: 24, fontWeight: '700' },
});
