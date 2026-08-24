import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, findNodeHandle, ScrollView, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { getActiveWorkoutId, startWorkout } from '../database/workouts';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Hero } from '../ui/Hero';
import { Loader } from '../ui/Loader';
import { useWorkoutDrafts } from '../workoutDrafts';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useAppTheme();
  const { drafts } = useWorkoutDrafts();
  const [activeWorkoutId, setActiveWorkoutId] = useState<number | null>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const allowNavigation = useRef(false);
  const startWorkoutRef = useRef<View>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    getActiveWorkoutId(database).then(
      (id) => { if (active) { setActiveWorkoutId(id); setError(false); } },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [database, reload]));
  useEffect(() => AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') setReload((value) => value + 1);
  }).remove, []);
  usePreventRemove(starting, ({ data }) => {
    if (allowNavigation.current) navigation.dispatch(data.action);
  });

  useFocusEffect(useCallback(() => {
    if (!route.params?.focusStartWorkout || activeWorkoutId !== null) return;
    const handle = findNodeHandle(startWorkoutRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    navigation.setParams({ focusStartWorkout: undefined });
  }, [activeWorkoutId, navigation, route.params?.focusStartWorkout]));

  async function openWorkout() {
    if (activeWorkoutId !== null) {
      navigation.navigate('Workout');
      return;
    }
    setStarting(true);
    setError(false);
    try {
      await startWorkout(database);
      allowNavigation.current = true;
      navigation.navigate('Workout');
    } catch {
      setError(true);
    } finally {
      setStarting(false);
    }
  }

  const hasUnsavedDraft = activeWorkoutId !== null && Object.values(drafts).some((draft) =>
    draft.workoutId === activeWorkoutId && draft.unsaved,
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    >
      <Hero
        title="Klar for en økt?"
        description="Registrer øvelser og sett mens du trener."
        testID="home-hero"
      />
      <View style={styles.actions}>
        {error ? (
          <Button
            title="Prøv igjen"
            variant="primary"
            onPress={() => {
              setError(false);
              setActiveWorkoutId(undefined);
              setReload((value) => value + 1);
            }}
            testID="home-retry"
          />
        ) : activeWorkoutId === undefined ? (
          <Loader label="Laster aktiv økt" size="compact" testID="home-loader" />
        ) : (
          <Button
            ref={startWorkoutRef}
            title={starting ? 'Starter økt' : activeWorkoutId === null ? 'Start økt' : 'Fortsett økt'}
            variant="primary"
            busy={starting}
            disabled={starting}
            onPress={() => void openWorkout()}
            testID="home-primary-action"
          />
        )}
        {hasUnsavedDraft && (
          <ErrorAlert message="Økten har endringer som ikke er lagret" testID="home-unsaved-warning" />
        )}
        {error && <ErrorAlert message="Kunne ikke laste inn" testID="home-error" />}
        <Button
          title="Tidligere økter"
          variant="secondary"
          disabled={starting}
          onPress={() => navigation.navigate('History')}
          testID="home-history"
        />
        <Button
          title="Øvelser"
          variant="secondary"
          disabled={starting}
          onPress={() => navigation.navigate('Exercises')}
          testID="home-exercises"
        />
        <Button
          title="Innstillinger"
          variant="secondary"
          disabled={starting}
          onPress={() => navigation.navigate('Settings')}
          testID="home-settings"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  actions: {
    gap: 12,
    marginTop: 28,
  },
});
