import { usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
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

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'missing' }
  | { status: 'ready'; exercise: ExerciseDetail };

export function ExerciseDetailScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
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
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showRenameError(validation.error);
      return;
    }
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
      setSaving(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    requestAnimationFrame(() => focus(deleteRef));
  }

  async function confirmDeletion(exercise: ExerciseDetail) {
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
      setDeleting(false);
    }
  }

  if (state.status === 'loading') {
    return <ActivityIndicator accessibilityLabel="Laster øvelse" style={styles.center} />;
  }
  if (state.status === 'failed') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Kunne ikke laste inn</Text>
      <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke laste inn øvelsen.</Text>
      <Action actionRef={retryRef} label="Prøv igjen" onPress={() => setReload((value) => value + 1)} />
    </View>
  );
  if (state.status === 'missing') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Finnes ikke lenger</Text>
      <Action label="Tilbake til øvelser" onPress={() => navigation.popTo('Exercises')} />
    </View>
  );

  const { exercise } = state;
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{exercise.name}</Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Endre navn</Text>
        <TextInput
          accessibilityLabel={renameError ? `Navn. Feil: ${renameError}` : 'Navn'}
          accessibilityHint={renameError ? 'Rett navnet og prøv igjen' : undefined}
          accessibilityState={{ disabled: saving || deleting }}
          editable={!saving && !deleting}
          onChangeText={(value) => { setDraft(value); setRenameError(undefined); }}
          onSubmitEditing={() => void saveName(exercise)}
          ref={inputRef}
          returnKeyType="done"
          style={[styles.input, { borderColor: renameError ? colors.notification : colors.border, color: colors.text }]}
          value={draft}
        />
        {renameError && <Text accessibilityRole="alert" style={{ color: colors.notification }}>{renameError}</Text>}
        <Action disabled={saving || deleting} label={saving ? 'Lagrer navn' : 'Lagre navn'} onPress={() => void saveName(exercise)} />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Historikk</Text>
        {exercise.history.length === 0 ? (
          <Text style={{ color: colors.text }}>Ingen fullførte økter med denne øvelsen ennå</Text>
        ) : exercise.history.map((workout) => (
          <View key={workout.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.workoutTitle, { color: colors.text }]}>
              {formatDateTime(new Date(workout.completedAt))}
            </Text>
            {workout.sets.map((set, index) => (
              <View
                accessible
                accessibilityLabel={`Sett ${index + 1}, ${set.repetitions} repetisjoner med ${formatLoad(set.loadKg)} kilogram`}
                key={set.id}
                style={[styles.set, { borderColor: colors.border }]}
              >
                <Text style={[styles.setTitle, { color: colors.text }]}>Sett {index + 1}</Text>
                <Text style={{ color: colors.text }}>{formatLoad(set.loadKg)} kg · {set.repetitions} repetisjoner</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {exercise.canDelete && (
        <Action actionRef={deleteRef} destructive disabled={saving || deleting} label="Slett øvelse" onPress={() => {
          setDeleteFailed(false);
          setDeleteDialogOpen(true);
        }} />
      )}
      {deleteFailed && (
        <View style={styles.failure}>
          <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke slette øvelsen</Text>
          <Action actionRef={retryRef} label="Prøv igjen" onPress={() => {
            setDeleteFailed(false);
            setReload((value) => value + 1);
          }} />
        </View>
      )}
      <Modal animationType="none" onRequestClose={closeDeleteDialog} onShow={() => focus(confirmDeleteRef)} transparent visible={deleteDialogOpen}>
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text accessibilityRole="header" style={[styles.dialogTitle, { color: colors.text }]}>Slett {exercise.name}?</Text>
            <Text style={{ color: colors.text }}>Øvelsen slettes permanent. Dette kan ikke angres.</Text>
            <Action disabled={deleting} label="Avbryt" onPress={closeDeleteDialog} />
            <Action actionRef={confirmDeleteRef} destructive disabled={deleting} label={deleting ? 'Sletter øvelse' : 'Slett'} onPress={() => void confirmDeletion(exercise)} />
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
      accessibilityState={{ busy: disabled && /Lagrer|Sletter/.test(label), disabled }}
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
  container: { flexGrow: 1, gap: 24, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  title: { fontSize: 30, fontWeight: '700' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '700' },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 18, minHeight: 52, paddingHorizontal: 14 },
  card: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  workoutTitle: { fontSize: 18, fontWeight: '700' },
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
