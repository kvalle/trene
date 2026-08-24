import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  getActiveWorkoutId,
  listCompletedWorkouts,
  startWorkout,
  type CompletedWorkoutListItem,
} from '../database/workouts';
import { formatDateTime } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { PageStatus } from '../ui/PageStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; activeWorkoutId: number | null; workouts: CompletedWorkoutListItem[] };

export function HistoryScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const allowNavigation = useRef(false);
  const retryRef = useRef<View>(null);
  const emptyActionRef = useRef<View>(null);
  const workoutRefs = useRef(new Map<number, View>());

  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ status: 'loading' });
    listCompletedWorkouts(database).then(async (workouts) => {
      const activeWorkoutId = workouts.length === 0 ? await getActiveWorkoutId(database) : null;
      if (active) setState({ status: 'ready', workouts, activeWorkoutId });
    }).catch(
      () => active && setState({ status: 'failed' }),
    );
    return () => { active = false; };
  }, [database, reload]));

  usePreventRemove(starting, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  useEffect(() => {
    if (state.status !== 'failed') return;
    AccessibilityInfo.announceForAccessibility('Kunne ikke laste inn. Prøv igjen.');
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const focusWorkoutId = route.params?.focusWorkoutId;
    const target = focusWorkoutId === undefined ? null : workoutRefs.current.get(focusWorkoutId);
    const handle = findNodeHandle(target ?? (route.params?.focusEmptyAction ? emptyActionRef.current : null));
    if (!handle) return;
    AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ focusWorkoutId: undefined, focusEmptyAction: undefined });
  }, [navigation, route.params?.focusEmptyAction, route.params?.focusWorkoutId, state]);

  async function openWorkout(activeWorkoutId: number | null) {
    if (activeWorkoutId !== null) {
      navigation.navigate('Workout');
      return;
    }
    allowNavigation.current = false;
    setStarting(true);
    setStartFailed(false);
    try {
      await startWorkout(database);
      allowNavigation.current = true;
      navigation.navigate('Workout');
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster tidligere økter" />;
  }
  if (state.status === 'failed') return (
    <HistoryStatus title="Kunne ikke laste inn" message="Kunne ikke laste inn tidligere økter." error>
      <Button title="Prøv igjen" onPress={() => {
        setState({ status: 'loading' });
        setReload((value) => value + 1);
      }} ref={retryRef} />
    </HistoryStatus>
  );

  if (state.workouts.length === 0) return (
    <HistoryStatus title="Ingen fullførte økter ennå" message="Fullførte økter vil vises her.">
      <Button
        title={starting ? 'Starter økt' : state.activeWorkoutId === null ? 'Start økt' : 'Fortsett økt'}
        busy={starting}
        onPress={() => void openWorkout(state.activeWorkoutId)}
        ref={emptyActionRef}
      />
      {startFailed ? <ErrorAlert message="Kunne ikke starte økten." /> : null}
    </HistoryStatus>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ListContainer>
        {state.workouts.map((workout, index) => {
          const completedAt = formatDateTime(new Date(workout.completedAt));
          const count = `${workout.exerciseCount} ${workout.exerciseCount === 1 ? 'øvelse' : 'øvelser'}`;
          return (
            <NavigationRow
              accessibilityHint="Åpner den fullførte økten"
              accessibilityLabel={`${completedAt}, ${count}`}
              accessibilityRole="button"
              key={workout.id}
              onPress={() => navigation.navigate('CompletedWorkout', { workoutId: workout.id })}
              ref={(node) => {
                if (node) workoutRefs.current.set(workout.id, node);
                else workoutRefs.current.delete(workout.id);
              }}
              title={completedAt}
              description={count}
              showSeparator={index < state.workouts.length - 1}
            />
          );
        })}
      </ListContainer>
    </ScrollView>
  );
}

function HistoryStatus({
  children,
  error = false,
  message,
  title,
}: {
  children: React.ReactNode;
  error?: boolean;
  message: string;
  title: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[typography.sectionTitle, styles.heading, { color: colors.text }]}>{title}</Text>
      <Text accessibilityRole={error ? 'alert' : undefined} style={[typography.body, styles.explanation, { color: colors.text }]}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  heading: { textAlign: 'center' },
  explanation: { textAlign: 'center' },
});
