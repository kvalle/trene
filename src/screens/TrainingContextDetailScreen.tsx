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
  DuplicateTrainingContextNameError,
  DUPLICATE_TRAINING_CONTEXT_NAME,
  loadTrainingContextDetail,
  renameTrainingContext,
  TrainingContextNotFoundError,
  type TrainingContextDetail,
} from '../database/trainingContexts';
import { validateExerciseName } from '../domain/exerciseName';
import { formatWorkoutCount } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { PageStatus } from '../ui/PageStatus';
import { TextField } from '../ui/TextField';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingContextDetail'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'missing' }
  | { status: 'ready'; trainingContext: TrainingContextDetail };

export function TrainingContextDetailScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState('');
  const [renameError, setRenameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const retryRef = useRef<View>(null);
  const savingRef = useRef(false);

  usePreventRemove(saving, () => undefined);

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
    if (savingRef.current) return;
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showRenameError(validation.error);
      return;
    }
    savingRef.current = true;
    setSaving(true);
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
      savingRef.current = false;
      setSaving(false);
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
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.title}>
        <Text accessibilityRole="header" style={[typography.screenTitle, textStyle]}>{trainingContext.name}</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          {formatWorkoutCount(trainingContext.workoutCount)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, textStyle]}>Endre navn</Text>
        <TextField
          label="Navn"
          error={renameError}
          editable={!saving}
          onChangeText={(value) => { setDraft(value); setRenameError(undefined); }}
          onSubmitEditing={() => void saveName(trainingContext)}
          ref={inputRef}
          returnKeyType="done"
          value={draft}
          testID="training-context-rename-input"
        />
        <Button
          busy={saving}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 24, padding: 20 },
  title: { gap: 4 },
  section: { gap: 12 },
  plainList: { gap: 6 },
});
