import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  createTrainingContext,
  DuplicateTrainingContextNameError,
  DUPLICATE_TRAINING_CONTEXT_NAME,
} from '../database/trainingContexts';
import { validateExerciseName } from '../domain/exerciseName';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTrainingContext'>;

export function CreateTrainingContextScreen({ navigation }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const allowSuccessfulNavigation = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  usePreventRemove(saving, ({ data }) => {
    if (allowSuccessfulNavigation.current) navigation.dispatch(data.action);
  });

  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
    inputRef.current?.focus();
  }

  async function save() {
    if (saving) return;
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showError(validation.error);
      return;
    }
    setSaving(true);
    try {
      const trainingContextId = await createTrainingContext(database, validation.name, validation.key);
      allowSuccessfulNavigation.current = true;
      navigation.popTo('TrainingContexts', { createdTrainingContextId: trainingContextId });
    } catch (saveError) {
      showError(saveError instanceof DuplicateTrainingContextNameError
        ? DUPLICATE_TRAINING_CONTEXT_NAME
        : 'Kunne ikke opprette konteksten. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
    >
      <Text style={[typography.body, { color: colors.text }]}>
        Gi konteksten et navn, for eksempel «Treningssenter».
      </Text>
      <TextField
        ref={inputRef}
        label="Navn"
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setError(undefined);
        }}
        error={error}
        editable={!saving}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        testID="training-context-name-input"
      />
      <Button
        title={saving ? 'Lagrer…' : 'Opprett'}
        busy={saving}
        disabled={saving}
        onPress={() => void save()}
        testID="create-training-context-submit"
      />
      <Button
        title="Avbryt"
        variant="text"
        disabled={saving}
        onPress={() => navigation.goBack()}
        testID="create-training-context-cancel"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 24 },
});
