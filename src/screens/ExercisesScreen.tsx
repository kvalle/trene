import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { listExercises, searchExercises, type ExerciseListItem } from '../database/exercises';
import { typography } from '../theme';
import { Button } from '../ui/Button';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { PageStatus } from '../ui/PageStatus';
import { SearchField } from '../ui/SearchField';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;
type LoadState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; exercises: ExerciseListItem[] };

export function ExercisesScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const retryRef = useRef<View>(null);
  const emptyActionRef = useRef<View>(null);
  const exerciseRefs = useRef(new Map<number, View>());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((current) => current.status === 'ready' ? current : { status: 'loading' });
      listExercises(database).then(
        (exercises) => active && setState({ status: 'ready', exercises }),
        () => active && setState({ status: 'failed' }),
      );
      return () => { active = false; };
    }, [database, reload]),
  );

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const focusExerciseId = route.params?.focusExerciseId;
    const target = focusExerciseId === undefined ? null : exerciseRefs.current.get(focusExerciseId);
    if (focusExerciseId !== undefined && !target && query.length > 0) {
      setQuery('');
      return;
    }
    const handle = findNodeHandle(target ?? (route.params?.focusEmptyAction ? emptyActionRef.current : null));
    if (!handle) return;
    AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ focusExerciseId: undefined, focusEmptyAction: undefined });
  }, [navigation, query, route.params?.focusEmptyAction, route.params?.focusExerciseId, state]);

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster øvelser" />;
  }

  if (state.status === 'failed') {
    return (
      <PageStatus
        variant="error"
        title="Kunne ikke laste inn"
        actionRef={retryRef}
        actionTitle="Prøv igjen"
        onAction={() => setReload((value) => value + 1)}
      />
    );
  }

  const matches = searchExercises(state.exercises, query);
  const isEmpty = state.exercises.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!isEmpty && (
        <SearchField
          label="Søk i øvelser"
          onChangeText={setQuery}
          value={query}
        />
      )}

      {isEmpty ? (
        <Button ref={emptyActionRef} title="Opprett første øvelse" onPress={() => navigation.navigate('CreateExercise')} />
      ) : matches.length === 0 ? (
        <View style={styles.noResultsState}>
          <Text accessibilityRole="header" style={typography.sectionTitle}>Ingen øvelser funnet</Text>
          <Button
            title={`Opprett «${query}»`}
            onPress={() => navigation.navigate('CreateExercise', { initialName: query })}
          />
        </View>
      ) : (
        <>
          <ListContainer>
            {matches.map((exercise, index) => (
              <NavigationRow
                accessibilityHint="Åpner detaljer for øvelsen"
                key={exercise.id}
                onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: exercise.id })}
                ref={(node) => {
                  if (node) exerciseRefs.current.set(exercise.id, node);
                  else exerciseRefs.current.delete(exercise.id);
                }}
                showSeparator={index < matches.length - 1}
                title={exercise.name}
                metadata={`Brukt i ${exercise.workoutCount} ${exercise.workoutCount === 1 ? 'økt' : 'økter'}`}
              />
            ))}
          </ListContainer>
          <Button title="Opprett øvelse" variant="secondary" onPress={() => navigation.navigate('CreateExercise')} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
  noResultsState: { alignItems: 'center', gap: 24, paddingVertical: 24 },
});
