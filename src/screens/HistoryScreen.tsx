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
import { buildMonthOverview, monthKey } from '../domain/monthOverview';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { DisclosureCard } from '../ui/DisclosureCard';
import { MonthCalendar } from '../ui/MonthCalendar';
import { PageStatus } from '../ui/PageStatus';
import { useActiveWorkoutVisibility } from '../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; activeWorkoutId: number | null; workouts: CompletedWorkoutListItem[]; today: Date };

export function HistoryScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { reconcile } = useActiveWorkoutVisibility();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const allowNavigation = useRef(false);
  const retryRef = useRef<View>(null);
  const emptyActionRef = useRef<View>(null);
  const monthRefs = useRef(new Map<string, View>());
  const [expandedMonths, setExpandedMonths] = useState<Set<string> | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    // Keep showing the overview while refreshing so expanded months and scroll position survive.
    setState((current) => (current.status === 'ready' && current.workouts.length > 0 ? current : { status: 'loading' }));
    listCompletedWorkouts(database).then(async (workouts) => {
      const activeWorkoutId = workouts.length === 0 ? await getActiveWorkoutId(database) : null;
      if (active) setState({ status: 'ready', workouts, activeWorkoutId, today: new Date() });
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
    const focusWorkout = state.workouts.find((workout) => workout.id === focusWorkoutId);
    const target = focusWorkout ? monthRefs.current.get(monthKey(new Date(focusWorkout.completedAt))) : null;
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
      void reconcile();
      allowNavigation.current = true;
      navigation.navigate('Workout');
    } catch {
      setStartFailed(true);
    } finally {
      setStarting(false);
    }
  }

  if (state.status === 'loading') {
    return <PageStatus variant="loading" loaderLabel="Laster tidligere treninger" />;
  }
  if (state.status === 'failed') return (
    <HistoryStatus title="Kunne ikke laste inn" message="Kunne ikke laste inn tidligere treninger." error>
      <Button title="Prøv igjen" onPress={() => {
        setState({ status: 'loading' });
        setReload((value) => value + 1);
      }} ref={retryRef} />
    </HistoryStatus>
  );

  if (state.workouts.length === 0) return (
    <HistoryStatus title="Ingen fullførte treninger ennå" message="Fullførte treninger vil vises her.">
      <Button
        title={starting ? 'Starter trening' : state.activeWorkoutId === null ? 'Start trening' : 'Fortsett trening'}
        busy={starting}
        onPress={() => void openWorkout(state.activeWorkoutId)}
        ref={emptyActionRef}
      />
      {startFailed ? <ErrorAlert message="Kunne ikke starte treningen." /> : null}
    </HistoryStatus>
  );

  const overview = buildMonthOverview(state.workouts, state.today);
  const expanded = expandedMonths ?? new Set(overview.initiallyExpanded ? [overview.initiallyExpanded] : []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {overview.months.map((month) => {
        const open = expanded.has(month.key);
        return (
          <DisclosureCard
            key={month.key}
            accessibilityLabel={`${month.title}, ${month.summary}`}
            expanded={open}
            headerRef={(node) => {
              if (node) monthRefs.current.set(month.key, node);
              else monthRefs.current.delete(month.key);
            }}
            onPress={() => {
              const next = new Set(expanded);
              if (open) next.delete(month.key);
              else next.add(month.key);
              setExpandedMonths(next);
            }}
            summary={month.summary}
            testID={`history-month-${month.key}`}
            title={month.title}
          >
            <MonthCalendar
              year={month.year}
              month={month.month}
              testID={`history-calendar-${month.key}`}
              getDay={(day) => {
                const workouts = month.days.get(day);
                return {
                  accessibilityLabel: month.dayLabel(day),
                  highlighted: workouts !== undefined,
                  inactive: month.isInactive(day),
                  today: month.isToday(day),
                  onPress: workouts
                    ? () => navigation.navigate('CompletedWorkout', { workoutId: workouts[0].id })
                    : undefined,
                };
              }}
            />
          </DisclosureCard>
        );
      })}
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
  container: { flexGrow: 1, gap: 12, padding: 20 },
  center: { alignItems: 'center', flex: 1, gap: 20, justifyContent: 'center', padding: 24 },
  heading: { textAlign: 'center' },
  explanation: { textAlign: 'center' },
});
