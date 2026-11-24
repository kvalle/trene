import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { listTrainingContexts, type TrainingContextListItem } from '../database/trainingContexts';
import {
  getActiveWorkoutId,
  listCompletedWorkouts,
  type CompletedWorkoutListItem,
} from '../database/workouts';
import { historyFilterSummary, selectedHistoryContexts, toggleHistoryContext } from '../domain/historyFilter';
import { buildMonthOverview, monthKey } from '../domain/monthOverview';
import { historyFilterPreferenceStore } from '../preferences/historyFilterPreference';
import { formatTime } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { CheckboxRow } from '../ui/CheckboxRow';
import { CompactAction } from '../ui/CompactAction';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Dialog } from '../ui/Dialog';
import { DisclosureCard } from '../ui/DisclosureCard';
import { ListContainer } from '../ui/ListContainer';
import { MonthCalendar } from '../ui/MonthCalendar';
import { NavigationRow } from '../ui/NavigationRow';
import { PageStatus } from '../ui/PageStatus';
import { useActiveWorkoutVisibility } from '../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';
import { useWorkoutStart } from './WorkoutStartDialog';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
    status: 'ready';
    activeWorkoutId: number | null;
    workouts: CompletedWorkoutListItem[];
    /** Kontekster with completed treningsøkter, in display order. */
    contexts: TrainingContextListItem[];
    today: Date;
  };

export function HistoryScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { reconcile } = useActiveWorkoutVisibility();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [startFailed, setStartFailed] = useState(false);
  const allowNavigation = useRef(false);
  const { start, starting, dialog: workoutStartDialog } = useWorkoutStart({
    onStarted: () => {
      void reconcile();
      allowNavigation.current = true;
      navigation.navigate('Workout');
    },
    onFailed: () => setStartFailed(true),
  });
  const retryRef = useRef<View>(null);
  const emptyActionRef = useRef<View>(null);
  const monthRefs = useRef(new Map<string, View>());
  const [expandedMonths, setExpandedMonths] = useState<Set<string> | null>(null);
  const [dayChoice, setDayChoice] = useState<{ title: string; workouts: CompletedWorkoutListItem[] } | null>(null);
  const dayChoiceTitleRef = useRef<Text>(null);
  const [hiddenContexts, setHiddenContexts] = useState<Set<number> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let active = true;
    historyFilterPreferenceStore.read().catch(() => new Set<number>()).then((hidden) => {
      if (active) setHiddenContexts((current) => current ?? hidden);
    });
    return () => { active = false; };
  }, []);

  const contextIds = useMemo(
    () => (state.status === 'ready' ? state.contexts.map((context) => context.id) : []),
    [state],
  );
  const selectedContexts = useMemo(
    () => selectedHistoryContexts(contextIds, hiddenContexts ?? new Set()),
    [contextIds, hiddenContexts],
  );
  const shownWorkouts = useMemo(
    () => (state.status === 'ready'
      ? state.workouts.filter((workout) => contextIds.length < 2 || selectedContexts.has(workout.trainingContextId))
      : []),
    [contextIds, selectedContexts, state],
  );

  function updateHiddenContexts(hidden: Set<number>) {
    setHiddenContexts(hidden);
    historyFilterPreferenceStore.write(hidden).catch(() => {});
  }

  useFocusEffect(useCallback(() => {
    let active = true;
    // Keep showing the overview while refreshing so expanded months and scroll position survive.
    setState((current) => (current.status === 'ready' && current.workouts.length > 0 ? current : { status: 'loading' }));
    Promise.all([listCompletedWorkouts(database), listTrainingContexts(database)]).then(async ([workouts, all]) => {
      const activeWorkoutId = workouts.length === 0 ? await getActiveWorkoutId(database) : null;
      const contexts = all.filter((context) => context.workoutCount > 0);
      if (active) setState({ status: 'ready', workouts, contexts, activeWorkoutId, today: new Date() });
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
    const focusWorkout = shownWorkouts.find((workout) => workout.id === focusWorkoutId);
    const focusMonth = focusWorkout ? monthKey(new Date(focusWorkout.completedAt)) : null;
    if (focusMonth) {
      // Keep the remaining workout's calendar visible next to the focused month header.
      setExpandedMonths((current) => {
        const initial = buildMonthOverview(shownWorkouts, state.today).initiallyExpanded;
        const expanded = current ?? new Set(initial ? [initial] : []);
        return expanded.has(focusMonth) ? current : new Set([...expanded, focusMonth]);
      });
    }
    const target = focusMonth ? monthRefs.current.get(focusMonth) : null;
    const handle = findNodeHandle(target ?? (route.params?.focusEmptyAction ? emptyActionRef.current : null));
    if (!handle) return;
    AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ focusWorkoutId: undefined, focusEmptyAction: undefined });
  }, [navigation, route.params?.focusEmptyAction, route.params?.focusWorkoutId, shownWorkouts, state]);

  async function openWorkout(activeWorkoutId: number | null) {
    if (activeWorkoutId !== null) {
      navigation.navigate('Workout');
      return;
    }
    allowNavigation.current = false;
    setStartFailed(false);
    await start();
  }

  if (state.status === 'loading' || (state.status === 'ready' && hiddenContexts === null)) {
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
      {workoutStartDialog}
    </HistoryStatus>
  );

  const overview = buildMonthOverview(shownWorkouts, state.today);
  const filterSummary = historyFilterSummary(state.contexts, selectedContexts);
  const allSelected = selectedContexts.size === state.contexts.length;
  const expanded = expandedMonths ?? new Set(overview.initiallyExpanded ? [overview.initiallyExpanded] : []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {state.contexts.length >= 2 ? (
        <DisclosureCard
          accessibilityLabel={`Filter, ${filterSummary}`}
          expanded={filterOpen}
          onPress={() => setFilterOpen((open) => !open)}
          summary={filterSummary}
          testID="history-filter"
          title="Filter"
        >
          <ListContainer>
            {state.contexts.map((context, index) => {
              const checked = selectedContexts.has(context.id);
              return (
                <CheckboxRow
                  key={context.id}
                  badge={context.archived ? 'Arkivert' : undefined}
                  checked={checked}
                  count={context.workoutCount}
                  locked={checked && selectedContexts.size === 1}
                  onCheckedChange={() => updateHiddenContexts(
                    toggleHistoryContext(contextIds, hiddenContexts ?? new Set(), context.id),
                  )}
                  showSeparator={index < state.contexts.length - 1}
                  testID={`history-filter-context-${context.id}`}
                  title={context.name}
                />
              );
            })}
          </ListContainer>
          {allSelected ? null : (
            <CompactAction
              icon="restore"
              label="Vis alle"
              onPress={() => {
                const hidden = new Set(hiddenContexts ?? []);
                contextIds.forEach((id) => hidden.delete(id));
                updateHiddenContexts(hidden);
              }}
              style={styles.showAll}
              testID="history-filter-show-all"
              tone="neutral"
            />
          )}
        </DisclosureCard>
      ) : null}
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
                    ? () => {
                      if (workouts.length === 1) {
                        navigation.navigate('CompletedWorkout', { workoutId: workouts[0].id });
                        return;
                      }
                      setDayChoice({
                        title: capitalize(month.dayLabel(day).split(', ')[0]),
                        workouts: [...workouts].sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
                      });
                    }
                    : undefined,
                };
              }}
            />
          </DisclosureCard>
        );
      })}
      <Dialog
        initialFocusRef={dayChoiceTitleRef}
        onRequestClose={() => setDayChoice(null)}
        testID="history-day-choice"
        title={dayChoice?.title ?? ''}
        titleRef={dayChoiceTitleRef}
        visible={dayChoice !== null}
      >
        <ListContainer>
          {dayChoice?.workouts.map((workout, index) => {
            const time = formatTime(new Date(workout.completedAt));
            const count = `${workout.exerciseCount} ${workout.exerciseCount === 1 ? 'øvelse' : 'øvelser'}`;
            return (
              <NavigationRow
                accessibilityHint="Åpner den fullførte treningen"
                description={count}
                key={workout.id}
                onPress={() => {
                  setDayChoice(null);
                  navigation.navigate('CompletedWorkout', { workoutId: workout.id });
                }}
                showSeparator={index < dayChoice.workouts.length - 1}
                title={`Kl. ${time}`}
              />
            );
          })}
        </ListContainer>
        <Button title="Avbryt" variant="secondary" onPress={() => setDayChoice(null)} />
      </Dialog>
    </ScrollView>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  showAll: { alignSelf: 'flex-start' },
});
