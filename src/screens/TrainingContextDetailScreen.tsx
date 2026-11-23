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
  activateTrainingContext,
  archiveTrainingContext,
  deleteTrainingContext,
  DuplicateTrainingContextNameError,
  DUPLICATE_TRAINING_CONTEXT_NAME,
  LastActiveTrainingContextError,
  loadTrainingContextDetail,
  renameTrainingContext,
  TrainingContextInUseError,
  TrainingContextNotFoundError,
  type TrainingContextDetail,
} from '../database/trainingContexts';
import { validateExerciseName } from '../domain/exerciseName';
import { formatWorkoutCount } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { PageStatus } from '../ui/PageStatus';
import { PositiveStatus } from '../ui/PositiveStatus';
import { TextField } from '../ui/TextField';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingContextDetail'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'missing' }
  | { status: 'ready'; trainingContext: TrainingContextDetail };
type Operation = 'rename' | 'archive' | 'activate' | 'delete';

/** Explains why a kontekst cannot be deleted, or returns undefined when it can. */
function deleteBlockedReason(trainingContext: TrainingContextDetail): string | undefined {
  if (trainingContext.hasActiveWorkout) {
    return 'Konteksten brukes av treningen som pågår, og kan ikke slettes.';
  }
  if (trainingContext.workoutCount > 0) {
    return trainingContext.archived
      ? 'Konteksten har tidligere treninger og kan ikke slettes.'
      : 'Konteksten har tidligere treninger og kan ikke slettes. Arkiver den i stedet for å skjule den når du starter en trening.';
  }
  if (trainingContext.isLastActive) {
    return 'Du må ha minst én aktiv kontekst. Lag eller aktiver en annen kontekst før du sletter denne.';
  }
  return undefined;
}

export function TrainingContextDetailScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState('');
  const [renameError, setRenameError] = useState<string>();
  const [operation, setOperation] = useState<Operation>();
  const [dialog, setDialog] = useState<'archive' | 'delete'>();
  const [actionError, setActionError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const inputRef = useRef<TextInput>(null);
  const retryRef = useRef<View>(null);
  const archiveRef = useRef<View>(null);
  const deleteRef = useRef<View>(null);
  const confirmRef = useRef<View>(null);
  const operationRef = useRef<Operation | undefined>(undefined);
  const allowNavigation = useRef(false);
  const saving = operation === 'rename';
  const busy = operation !== undefined;

  usePreventRemove(busy, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  function focus(target: React.RefObject<View | null>) {
    const handle = findNodeHandle(target.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }

  function begin(next: Operation): boolean {
    if (operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }

  function end() {
    operationRef.current = undefined;
    setOperation(undefined);
  }

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadTrainingContextDetail(database, route.params.trainingContextId).then(
      (trainingContext) => {
        if (!active) return;
        if (!trainingContext) setState({ status: 'missing' });
        else {
          setDraft(trainingContext.name);
          setState({ status: 'ready', trainingContext });
        }
      },
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.trainingContextId]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  function showRenameError(message: string) {
    setRenameError(message);
    AccessibilityInfo.announceForAccessibility(message);
    inputRef.current?.focus();
  }

  async function saveName(trainingContext: TrainingContextDetail) {
    if (operationRef.current) return;
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showRenameError(validation.error);
      return;
    }
    if (!begin('rename')) return;
    try {
      await renameTrainingContext(database, trainingContext.id, validation.name, validation.key);
      setDraft(validation.name);
      setRenameError(undefined);
      setState({ status: 'ready', trainingContext: { ...trainingContext, name: validation.name } });
      AccessibilityInfo.announceForAccessibility('Navnet er lagret.');
    } catch (error) {
      if (error instanceof TrainingContextNotFoundError) setState({ status: 'missing' });
      else showRenameError(error instanceof DuplicateTrainingContextNameError
        ? DUPLICATE_TRAINING_CONTEXT_NAME
        : 'Kunne ikke endre navnet. Prøv igjen.');
    } finally {
      end();
    }
  }

  /** Reloads the kontekst in place, without replacing the screen with a loader. */
  async function refresh(trainingContextId: number) {
    try {
      const trainingContext = await loadTrainingContextDetail(database, trainingContextId);
      setState(trainingContext ? { status: 'ready', trainingContext } : { status: 'missing' });
    } catch {
      // Keep the current details; the next visit loads them again.
    }
  }

  function failAction(trainingContextId: number, message: string) {
    setActionError(message);
    AccessibilityInfo.announceForAccessibility(message);
    void refresh(trainingContextId);
  }

  function closeDialog() {
    if (busy) return;
    const target = dialog === 'archive' ? archiveRef : deleteRef;
    setDialog(undefined);
    requestAnimationFrame(() => focus(target));
  }

  async function changeArchived(trainingContext: TrainingContextDetail, archived: boolean) {
    if (!begin(archived ? 'archive' : 'activate')) return;
    setActionError(undefined);
    setStatusMessage(undefined);
    try {
      if (archived) await archiveTrainingContext(database, trainingContext.id);
      else await activateTrainingContext(database, trainingContext.id);
      setDialog(undefined);
      setStatusMessage(archived ? 'Konteksten er arkivert.' : 'Konteksten er aktivert.');
      setState({ status: 'ready', trainingContext: { ...trainingContext, archived, isLastActive: false } });
      await refresh(trainingContext.id);
    } catch (error) {
      setDialog(undefined);
      if (error instanceof TrainingContextNotFoundError) setState({ status: 'missing' });
      else if (error instanceof LastActiveTrainingContextError) {
        failAction(trainingContext.id, 'Konteksten er den eneste aktive og kan ikke arkiveres.');
      } else failAction(trainingContext.id, archived ? 'Kunne ikke arkivere konteksten. Prøv igjen.' : 'Kunne ikke aktivere konteksten. Prøv igjen.');
    } finally {
      end();
    }
  }

  async function confirmDeletion(trainingContext: TrainingContextDetail) {
    if (!begin('delete')) return;
    setActionError(undefined);
    try {
      await deleteTrainingContext(database, trainingContext.id);
      allowNavigation.current = true;
      navigation.popTo('TrainingContexts', { deletedTrainingContext: true });
    } catch (error) {
      setDialog(undefined);
      if (error instanceof TrainingContextNotFoundError) setState({ status: 'missing' });
      else if (error instanceof TrainingContextInUseError || error instanceof LastActiveTrainingContextError) {
        failAction(trainingContext.id, 'Konteksten kan ikke slettes lenger.');
      } else failAction(trainingContext.id, 'Kunne ikke slette konteksten. Prøv igjen.');
    } finally {
      end();
    }
  }

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster kontekst" />;
  }
  if (state.status === 'failed') return (
    <PageStatus
      variant="error"
      title="Kunne ikke laste inn"
      message="Kunne ikke laste inn konteksten."
      actionRef={retryRef}
      actionTitle="Prøv igjen"
      onAction={() => setReload((value) => value + 1)}
    />
  );
  if (state.status === 'missing') return (
    <PageStatus
      variant="missing"
      title="Finnes ikke lenger"
      actionTitle="Tilbake til kontekster"
      onAction={() => navigation.popTo('TrainingContexts')}
    />
  );

  const { trainingContext } = state;
  const textStyle = { color: colors.text };
  const deleteReason = deleteBlockedReason(trainingContext);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.title}>
          <Text accessibilityRole="header" style={[typography.screenTitle, textStyle]}>{trainingContext.name}</Text>
          {trainingContext.archived && <Badge label="Arkivert" testID="training-context-archived-badge" />}
          <Text style={[typography.metadata, { color: colors.muted }]}>
            {formatWorkoutCount(trainingContext.workoutCount)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Endre navn</Text>
          <TextField
            label="Navn"
            error={renameError}
            editable={!busy}
            onChangeText={(value) => { setDraft(value); setRenameError(undefined); }}
            onSubmitEditing={() => void saveName(trainingContext)}
            ref={inputRef}
            returnKeyType="done"
            value={draft}
            testID="training-context-rename-input"
          />
          <Button
            busy={saving}
            disabled={busy && !saving}
            title={saving ? 'Lagrer navn' : 'Lagre navn'}
            onPress={() => void saveName(trainingContext)}
            testID="training-context-rename-submit"
          />
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Øvelser sist</Text>
          {trainingContext.lastExercises.length === 0 ? (
            <Text style={[typography.body, { color: colors.muted }]}>Ingen ennå.</Text>
          ) : (
            <View accessibilityRole="list" style={styles.plainList}>
              {trainingContext.lastExercises.map((name, index) => (
                <Text key={`${index}-${name}`} style={[typography.body, textStyle]}>{name}</Text>
              ))}
            </View>
          )}
        </View>

        {trainingContext.archived ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Aktiver kontekst</Text>
            <Text style={[typography.body, textStyle]}>
              Når konteksten er aktiv, kan du velge den igjen når du starter en trening.
            </Text>
            <Button
              busy={operation === 'activate'}
              disabled={busy && operation !== 'activate'}
              title={operation === 'activate' ? 'Aktiverer kontekst' : 'Aktiver kontekst'}
              variant="secondary"
              onPress={() => void changeArchived(trainingContext, false)}
              testID="training-context-activate"
            />
          </View>
        ) : (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Arkiver kontekst</Text>
            <Text style={[typography.body, textStyle]}>
              {trainingContext.isLastActive
                ? 'Du må ha minst én aktiv kontekst for å kunne starte en trening. Lag eller aktiver en annen kontekst før du arkiverer denne.'
                : 'En arkivert kontekst vises ikke når du starter en trening. Tidligere treninger beholdes.'}
            </Text>
            <Button
              ref={archiveRef}
              disabled={busy || trainingContext.isLastActive}
              title="Arkiver kontekst"
              variant="secondary"
              onPress={() => { setActionError(undefined); setDialog('archive'); }}
              testID="training-context-archive"
            />
          </View>
        )}

        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Slett kontekst</Text>
          <Text style={[typography.body, textStyle]}>
            {deleteReason ?? 'Konteksten har ingen treninger og kan slettes.'}
          </Text>
          <Button
            ref={deleteRef}
            disabled={busy || deleteReason !== undefined}
            title="Slett kontekst"
            variant="destructive"
            onPress={() => { setActionError(undefined); setDialog('delete'); }}
            testID="training-context-delete"
          />
        </View>

        {actionError && <ErrorAlert message={actionError} />}

        <Dialog
          onRequestClose={closeDialog}
          visible={dialog === 'archive'}
          initialFocusRef={confirmRef}
          title={`Arkiver ${trainingContext.name}?`}
        >
          <Text style={[typography.body, textStyle]}>
            Konteksten vises ikke lenger når du starter en trening. Tidligere treninger beholdes, og du kan aktivere
            konteksten igjen senere.
          </Text>
          <View style={styles.dialogActions}>
            <Button disabled={busy} title="Avbryt" variant="secondary" onPress={closeDialog} />
            <Button
              ref={confirmRef}
              busy={operation === 'archive'}
              title={operation === 'archive' ? 'Arkiverer kontekst' : 'Arkiver'}
              onPress={() => void changeArchived(trainingContext, true)}
              testID="training-context-archive-confirm"
            />
          </View>
        </Dialog>
        <Dialog
          onRequestClose={closeDialog}
          visible={dialog === 'delete'}
          initialFocusRef={confirmRef}
          title={`Slett ${trainingContext.name}?`}
        >
          <Text style={[typography.body, textStyle]}>Konteksten slettes permanent. Dette kan ikke angres.</Text>
          <View style={styles.dialogActions}>
            <Button disabled={busy} title="Avbryt" variant="secondary" onPress={closeDialog} />
            <Button
              ref={confirmRef}
              busy={operation === 'delete'}
              title={operation === 'delete' ? 'Sletter kontekst' : 'Slett'}
              variant="destructive"
              onPress={() => void confirmDeletion(trainingContext)}
              testID="training-context-delete-confirm"
            />
          </View>
        </Dialog>
      </ScrollView>
      {statusMessage && (
        <PositiveStatus
          message={statusMessage}
          onDismiss={() => setStatusMessage(undefined)}
          testID="training-context-detail-status"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dialogActions: { gap: 12 },
  container: { flexGrow: 1, gap: 24, padding: 20 },
  title: { gap: 4 },
  section: { gap: 12 },
  plainList: { gap: 6 },
});
