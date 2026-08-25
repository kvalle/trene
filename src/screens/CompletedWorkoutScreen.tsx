import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { deleteCompletedWorkout, loadCompletedWorkout, type CompletedWorkout } from '../database/workouts';
import { formatDateTime, formatLoad } from '../locale';
import { typography } from '../theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataRow } from '../ui/DataRow';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { PageStatus } from '../ui/PageStatus';
import { useAppTheme } from '../ui/AppThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletedWorkout'>;
type State = { status: 'loading' } | { status: 'failed' } | { status: 'missing' } | { status: 'ready'; workout: CompletedWorkout };

export function CompletedWorkoutScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
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
    else if (!deleting) {
      allowNavigation.current = true;
      navigation.popTo('Home', { focusStartWorkout: true });
    }
  });

  useEffect(() => {
    let active = true;
    loadCompletedWorkout(database, route.params.workoutId).then(
      (workout) => active && setState(workout ? { status: 'ready', workout } : { status: 'missing' }),
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.workoutId]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    focus(retryRef);
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
      const params = result.focusWorkoutId === null ? { focusEmptyAction: true } : { focusWorkoutId: result.focusWorkoutId };
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

  if (state.status === 'loading') return <PageStatus variant="loading" loaderLabel="Laster fullført økt" />;
  if (state.status === 'failed') return (
    <PageStatus
      variant="error"
      title="Kunne ikke laste inn"
      message="Kunne ikke laste inn den fullførte økten."
      actionRef={retryRef}
      actionTitle="Prøv igjen"
      onAction={() => { setState({ status: 'loading' }); setReload((value) => value + 1); }}
    />
  );
  if (state.status === 'missing') return (
    <PageStatus
      variant="missing"
      title="Finnes ikke lenger"
      actionTitle={route.params.fromCompletion ? 'Tilbake til forsiden' : 'Tilbake til tidligere økter'}
      onAction={() => {
        allowNavigation.current = true;
        if (route.params.fromCompletion) navigation.popTo('Home', { focusStartWorkout: true });
        else navigation.popTo('History');
      }}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Fullført økt</Text>
      <Text style={[styles.completedAt, { color: colors.text }]}>{formatDateTime(new Date(state.workout.completedAt))}</Text>
      {state.workout.exercises.map((exercise) => (
        <Card key={exercise.id}>
          <Text accessibilityRole="header" style={[styles.exerciseTitle, { color: colors.text }]}>{exercise.name}</Text>
          {exercise.sets.map((set, index) => (
            <DataRow
              key={set.id}
              label={`Sett ${index + 1}`}
              value={`${formatLoad(set.loadKg!)} kg · ${set.repetitions} repetisjoner`}
              accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg!)} kilogram`}
              showSeparator
            />
          ))}
        </Card>
      ))}
      <Button ref={deleteRef} variant="destructive" title="Slett økt" onPress={() => { setDeleteFailed(false); setDeleteDialogOpen(true); }} />
      {deleteFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke slette økten" />
          <Button ref={retryRef} title="Prøv igjen" onPress={() => setDeleteDialogOpen(true)} />
        </View>
      )}
      {route.params.fromCompletion && (
        <Button
          variant="secondary"
          title="Tilbake til forsiden"
          onPress={() => { allowNavigation.current = true; navigation.popTo('Home', { focusStartWorkout: true }); }}
        />
      )}
      <Dialog onRequestClose={closeDeleteDialog} visible={deleteDialogOpen} initialFocusRef={confirmDeleteRef} title="Slett fullført økt?">
        <Text style={[styles.dialogMessage, { color: colors.text }]}>Den fullførte økten slettes permanent. Dette kan ikke angres.</Text>
        <View style={styles.dialogActions}>
          <Button disabled={deleting} title="Avbryt" variant="secondary" onPress={closeDeleteDialog} />
          <Button
            ref={confirmDeleteRef}
            busy={deleting}
            title={deleting ? 'Sletter økt' : 'Slett'}
            variant="destructive"
            onPress={() => void confirmDeletion(state.workout.id)}
          />
        </View>
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
  title: typography.screenTitle,
  completedAt: typography.body,
  exerciseTitle: typography.sectionTitle,
  failure: { gap: 10 },
  dialogMessage: typography.body,
  dialogActions: { gap: 12 },
});
