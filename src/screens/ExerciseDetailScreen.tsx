import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
  deleteExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
  ExerciseDeletionIneligibleError,
  ExerciseNotFoundError,
  loadExerciseDetail,
  renameExercise,
  type ExerciseDetail,
} from '../database/exercises';
import { validateExerciseName } from '../domain/exerciseName';
import { formatDateTime, formatLoad } from '../locale';
import { typography } from '../theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataRow } from '../ui/DataRow';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { PageStatus } from '../ui/PageStatus';
import { TextField } from '../ui/TextField';
import { useAppTheme } from '../ui/AppThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'missing' }
  | { status: 'ready'; exercise: ExerciseDetail };

export function ExerciseDetailScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState('');
  const [renameError, setRenameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const allowNavigation = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const retryRef = useRef<View>(null);
  const deleteRef = useRef<View>(null);
  const confirmDeleteRef = useRef<View>(null);
  const operationInProgress = useRef(false);

  usePreventRemove(saving || deleting, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadExerciseDetail(database, route.params.exerciseId).then(
      (exercise) => {
        if (!active) return;
        if (!exercise) setState({ status: 'missing' });
        else {
          setDraft(exercise.name);
          setState({ status: 'ready', exercise });
        }
      },
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.exerciseId]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    focus(retryRef);
  }, [state.status]);

  function focus(target: React.RefObject<View | null>) {
    const handle = findNodeHandle(target.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function showRenameError(message: string) {
    setRenameError(message);
    AccessibilityInfo.announceForAccessibility(message);
    inputRef.current?.focus();
  }

  async function saveName(exercise: ExerciseDetail) {
    if (operationInProgress.current) return;
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showRenameError(validation.error);
      return;
    }
    operationInProgress.current = true;
    setSaving(true);
    try {
      await renameExercise(database, exercise.id, validation.name, validation.key);
      setDraft(validation.name);
      setRenameError(undefined);
      setState({ status: 'ready', exercise: { ...exercise, name: validation.name } });
    } catch (error) {
      if (error instanceof ExerciseNotFoundError) setState({ status: 'missing' });
      else showRenameError(error instanceof DuplicateExerciseNameError
        ? DUPLICATE_EXERCISE_NAME
        : 'Kunne ikke endre navnet. Prøv igjen.');
    } finally {
      operationInProgress.current = false;
      setSaving(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    requestAnimationFrame(() => focus(deleteRef));
  }

  async function confirmDeletion(exercise: ExerciseDetail) {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      const result = await deleteExercise(database, exercise.id);
      allowNavigation.current = true;
      navigation.popTo('Exercises', result.focusExerciseId === null
        ? { focusEmptyAction: true }
        : { focusExerciseId: result.focusExerciseId });
    } catch (error) {
      setDeleteDialogOpen(false);
      if (error instanceof ExerciseNotFoundError) setState({ status: 'missing' });
      else {
        setDeleteFailed(true);
        AccessibilityInfo.announceForAccessibility(error instanceof ExerciseDeletionIneligibleError
          ? 'Øvelsen er nå i bruk og kan ikke slettes. Prøv igjen for å oppdatere.'
          : 'Kunne ikke slette øvelsen. Prøv igjen.');
        requestAnimationFrame(() => focus(retryRef));
      }
    } finally {
      operationInProgress.current = false;
      setDeleting(false);
    }
  }

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster øvelse" />;
  }
  if (state.status === 'failed') return (
    <PageStatus
      variant="error"
      title="Kunne ikke laste inn"
      message="Kunne ikke laste inn øvelsen."
      actionRef={retryRef}
      actionTitle="Prøv igjen"
      onAction={() => setReload((value) => value + 1)}
    />
  );
  if (state.status === 'missing') return (
    <PageStatus variant="missing" title="Finnes ikke lenger" actionTitle="Tilbake til øvelser" onAction={() => navigation.popTo('Exercises')} />
  );

  const { exercise } = state;
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>{exercise.name}</Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>Endre navn</Text>
        <TextField
          label="Navn"
          error={renameError}
          editable={!saving && !deleting}
          onChangeText={(value) => { setDraft(value); setRenameError(undefined); }}
          onSubmitEditing={() => void saveName(exercise)}
          ref={inputRef}
          returnKeyType="done"
          value={draft}
        />
        <Button busy={saving} disabled={deleting} title={saving ? 'Lagrer navn' : 'Lagre navn'} onPress={() => void saveName(exercise)} />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>Historikk</Text>
        {exercise.history.length === 0 ? (
          <Text style={[typography.body, { color: colors.text }]}>Ingen fullførte økter med denne øvelsen ennå</Text>
        ) : exercise.history.map((workout) => (
          <Card key={workout.id}>
            <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>
              {formatDateTime(new Date(workout.completedAt))}
            </Text>
            {workout.sets.map((set, index) => (
              <DataRow
                key={set.id}
                label={`Sett ${index + 1}`}
                value={`${formatLoad(set.loadKg)} kg · ${set.repetitions} repetisjoner`}
                accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg)} kilogram`}
                showSeparator
              />
            ))}
          </Card>
        ))}
      </View>

      {exercise.canDelete && (
        <Button ref={deleteRef} variant="destructive" disabled={saving || deleting} title="Slett øvelse" onPress={() => {
          setDeleteFailed(false);
          setDeleteDialogOpen(true);
        }} />
      )}
      {deleteFailed && (
        <View style={styles.failure}>
          <ErrorAlert message="Kunne ikke slette øvelsen" />
          <Button ref={retryRef} title="Prøv igjen" onPress={() => {
            setDeleteFailed(false);
            setReload((value) => value + 1);
          }} />
          <Button title="Lukk" variant="secondary" onPress={() => {
            setDeleteFailed(false);
            requestAnimationFrame(() => focus(deleteRef));
          }} />
        </View>
      )}
      <Dialog onRequestClose={closeDeleteDialog} visible={deleteDialogOpen} initialFocusRef={confirmDeleteRef} title={`Slett ${exercise.name}?`}>
        <Text style={[typography.body, { color: colors.text }]}>Øvelsen slettes permanent. Dette kan ikke angres.</Text>
        <View style={styles.dialogActions}>
          <Button disabled={deleting} title="Avbryt" variant="secondary" onPress={closeDeleteDialog} />
          <Button ref={confirmDeleteRef} busy={deleting} title={deleting ? 'Sletter øvelse' : 'Slett'} variant="destructive" onPress={() => void confirmDeletion(exercise)} />
        </View>
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 24, padding: 20 },
  section: { gap: 12 },
  failure: { gap: 10 },
  dialogActions: { gap: 12 },
});
