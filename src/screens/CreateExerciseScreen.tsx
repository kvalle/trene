import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  createExercise,
  DuplicateExerciseNameError,
  DUPLICATE_EXERCISE_NAME,
} from '../database/exercises';
import { createExerciseInWorkout } from '../database/workouts';
import { validateExerciseName } from '../domain/exerciseName';
import { typography } from '../theme';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { useAppTheme } from '../ui/AppThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateExercise'>;

export function CreateExerciseScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState(route.params?.initialName ?? '');
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
    const validation = validateExerciseName(draft);
    if ('error' in validation) {
      showError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const workoutId = route.params?.workoutId;
      const fromWorkout = route.params?.origin === 'workout' && workoutId !== undefined;
      const exerciseId = fromWorkout
        ? await createExerciseInWorkout(database, workoutId, validation.name, validation.key)
        : await createExercise(database, validation.name, validation.key);
      allowSuccessfulNavigation.current = true;
      if (fromWorkout) navigation.popTo('Workout', { focusExerciseId: exerciseId });
      else navigation.replace('ExerciseDetail', { exerciseId });
    } catch (saveError) {
      showError(
        saveError instanceof DuplicateExerciseNameError
          ? DUPLICATE_EXERCISE_NAME
          : 'Kunne ikke opprette øvelsen. Prøv igjen.',
      );
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
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>
        Opprett øvelse
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
        testID="exercise-name-input"
      />
      <Button
        title={saving ? 'Lagrer…' : 'Opprett'}
        variant="primary"
        busy={saving}
        disabled={saving}
        onPress={() => void save()}
        testID="create-exercise-submit"
      />
      <Button
        title="Avbryt"
        variant="text"
        disabled={saving}
        onPress={() => navigation.goBack()}
        testID="create-exercise-cancel"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 20,
    padding: 24,
  },
});
