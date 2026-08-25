import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { exerciseNameKey } from '../domain/exerciseName';
import { addExerciseToWorkout, countExercises, listAvailableExercises, type AvailableExercise } from '../database/workouts';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { ListContainer } from '../ui/ListContainer';
import { PageStatus } from '../ui/PageStatus';
import { SearchField } from '../ui/SearchField';
import { SelectionRow } from '../ui/SelectionRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ExercisePicker'>;
type State = { status: 'loading' } | { status: 'failed' } | {
  status: 'ready'; exercises: AvailableExercise[]; totalExerciseCount: number;
};

export function ExercisePickerScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<number>();
  const [saveError, setSaveError] = useState(false);
  const [reload, setReload] = useState(0);
  const allowNavigation = useRef(false);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listAvailableExercises(database, route.params.workoutId),
      countExercises(database),
    ]).then(
      ([exercises, totalExerciseCount]) => active && setState({ status: 'ready', exercises, totalExerciseCount }),
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload, route.params.workoutId]);
  useEffect(() => { if (state.status === 'ready' && state.exercises.length > 0) searchRef.current?.focus(); }, [state]);
  usePreventRemove(saving, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  async function select(exerciseId: number) {
    setSaving(true);
    setSavingExerciseId(exerciseId);
    setSaveError(false);
    try {
      await addExerciseToWorkout(database, route.params.workoutId, exerciseId);
      allowNavigation.current = true;
      navigation.popTo('Workout', { focusExerciseId: exerciseId });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
      setSavingExerciseId(undefined);
    }
  }

  if (state.status === 'loading') return <PageStatus variant="loading" loaderLabel="Laster øvelser" />;
  if (state.status === 'failed') return <PageStatus variant="error" title="Kunne ikke laste inn" actionTitle="Prøv igjen" onAction={() => setReload((value) => value + 1)} />;

  const matches = state.exercises.filter((exercise) => exerciseNameKey(exercise.name).includes(exerciseNameKey(query)));
  const emptyInstallation = state.totalExerciseCount === 0;
  const allAdded = state.exercises.length === 0 && state.totalExerciseCount > 0;

  function create(initialName?: string) {
    navigation.navigate('CreateExercise', {
      initialName,
      origin: 'workout',
      workoutId: route.params.workoutId,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!emptyInstallation && (
        <SearchField
          editable={!saving}
          onChangeText={setQuery}
          ref={searchRef}
          label="Søk i øvelser"
          value={query}
        />
      )}
      {saveError && (
        <ErrorAlert message="Kunne ikke legge til øvelsen. Prøv igjen." />
      )}
      {emptyInstallation ? (
        <PageStatus variant="empty" title="Ingen øvelser ennå" actionTitle="Opprett første øvelse" onAction={() => create()} />
      ) : allAdded ? (
        <PageStatus variant="empty" title="Alle eksisterende øvelser er lagt til" actionTitle="Opprett øvelse" onAction={() => create()} />
      ) : matches.length === 0 ? (
        <PageStatus variant="no-results" title="Ingen øvelser funnet" actionTitle={`Opprett «${query}»`} onAction={() => create(query)} />
      ) : (
        <>
          <ListContainer>
            {matches.map((exercise, index) => (
              <SelectionRow
                busy={savingExerciseId === exercise.id}
                disabled={saving}
                key={exercise.id}
                showSeparator={index < matches.length - 1}
                title={exercise.name}
                onPress={() => void select(exercise.id)}
              />
            ))}
          </ListContainer>
          <Button disabled={saving} title="Opprett øvelse" variant="secondary" onPress={() => create()} />
        </>
      )}
      <Button disabled={saving} title="Avbryt" variant="text" onPress={() => navigation.popTo('Workout', { focusAddExercise: true })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20 },
});
