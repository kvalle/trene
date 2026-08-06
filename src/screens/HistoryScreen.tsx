import { useFocusEffect, usePreventRemove, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import {
  getActiveWorkoutId,
  listCompletedWorkouts,
  startWorkout,
  type CompletedWorkoutListItem,
} from '../database/workouts';
import { formatDateTime } from '../locale';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; activeWorkoutId: number | null; workouts: CompletedWorkoutListItem[] };

export function HistoryScreen({ navigation }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const allowNavigation = useRef(false);
  const retryRef = useRef<View>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
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
    return <ActivityIndicator accessibilityLabel="Laster tidligere økter" style={styles.center} />;
  }
  if (state.status === 'failed') return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Kunne ikke laste inn</Text>
      <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke laste inn tidligere økter.</Text>
      <Action actionRef={retryRef} label="Prøv igjen" onPress={() => {
        setState({ status: 'loading' });
        setReload((value) => value + 1);
      }} primary />
    </View>
  );

  if (state.workouts.length === 0) return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Ingen fullførte økter ennå</Text>
      <Text style={[styles.explanation, { color: colors.text }]}>Fullførte økter vil vises her.</Text>
      <Action
        disabled={starting}
        label={starting ? 'Starter økt' : state.activeWorkoutId === null ? 'Start økt' : 'Fortsett økt'}
        onPress={() => void openWorkout(state.activeWorkoutId)}
        primary
      />
      {startFailed && <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke starte økten.</Text>}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.list}>
        {state.workouts.map((workout) => {
          const completedAt = formatDateTime(new Date(workout.completedAt));
          const count = `${workout.exerciseCount} ${workout.exerciseCount === 1 ? 'øvelse' : 'øvelser'}`;
          return (
            <Pressable
              accessibilityHint="Åpner den fullførte økten"
              accessibilityLabel={`${completedAt}, ${count}`}
              accessibilityRole="button"
              key={workout.id}
              onPress={() => navigation.navigate('CompletedWorkout', { workoutId: workout.id })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.rowDate, { color: colors.text }]}>{completedAt}</Text>
              <Text style={[styles.rowMeta, { color: colors.text }]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Action({
  actionRef,
  disabled = false,
  label,
  onPress,
  primary = false,
}: {
  actionRef?: React.RefObject<View | null>;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      ref={actionRef}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? colors.primary : colors.card, borderColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.background : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  heading: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  explanation: { fontSize: 17, textAlign: 'center' },
  list: { gap: 10 },
  row: { borderRadius: 14, borderWidth: 1, minHeight: 78, padding: 14 },
  rowDate: { fontSize: 18, fontWeight: '600' },
  rowMeta: { fontSize: 15, marginTop: 5, opacity: 0.75 },
  action: { alignItems: 'center', borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 20 },
  actionText: { fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
