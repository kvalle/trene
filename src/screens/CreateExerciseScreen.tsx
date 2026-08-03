import { usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  createExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
} from '../database/exercises';
import { validateExerciseName } from '../domain/exerciseName';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateExercise'>;

export function CreateExerciseScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [draft, setDraft] = useState(route.params?.initialName ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const allowSuccessfulNavigation = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);
  usePreventRemove(saving, ({ data }) => {
    if (allowSuccessfulNavigation.current) navigation.dispatch(data.action);
  });

  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
    inputRef.current?.focus();
  }

  async function save() {
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const exerciseId = await createExercise(database, validation.name, validation.key);
      allowSuccessfulNavigation.current = true;
      navigation.replace('ExerciseDetail', { exerciseId });
    } catch (saveError) {
      showError(saveError instanceof DuplicateExerciseNameError
        ? DUPLICATE_EXERCISE_NAME
        : 'Kunne ikke opprette øvelsen. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Opprett øvelse</Text>
      <Text style={[styles.label, { color: colors.text }]}>Navn</Text>
      <TextInput
        accessibilityLabel={error ? `Navn. Feil: ${error}` : 'Navn'}
        accessibilityHint={error ? 'Rett navnet og prøv igjen' : undefined}
        accessibilityState={{ disabled: saving }}
        autoCapitalize="sentences"
        editable={!saving}
        onChangeText={(value) => { setDraft(value); setError(undefined); }}
        onSubmitEditing={() => void save()}
        ref={inputRef}
        returnKeyType="done"
        style={[styles.input, { borderColor: error ? colors.notification : colors.border, color: colors.text }]}
        value={draft}
      />
      {error && (
        <Text style={[styles.error, { color: colors.notification }]}>{error}</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: saving, disabled: saving }}
        disabled={saving}
        onPress={() => void save()}
        style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, pressed && styles.pressed]}
      >
        <Text style={[styles.saveText, { color: colors.background }]}>{saving ? 'Lagrer…' : 'Opprett'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Text style={[styles.cancelText, { color: colors.text }]}>Avbryt</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 32 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 18, minHeight: 52, paddingHorizontal: 14 },
  error: { fontSize: 15, marginTop: 8 },
  save: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', marginTop: 28, minHeight: 52 },
  saveText: { fontSize: 18, fontWeight: '700' },
  cancel: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 48 },
  cancelText: { fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
