import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, usePreventRemove, useTheme } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useDatabase } from '../database/DatabaseContext';
import { getActiveWorkoutId, startWorkout } from '../database/workouts';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation, route }: Props) {
  const database = useDatabase();
  const { colors } = useTheme();
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        Klar for en økt?
      </Text>
      <Text style={[styles.introduction, { color: colors.text }]}>
        Registrer øvelser og sett mens du trener.
      </Text>
      <View style={styles.actions}>
        {error ? (
          <Action colors={colors} label="Prøv igjen" onPress={() => {
            setError(false);
            setActiveWorkoutId(undefined);
            setReload((value) => value + 1);
          }} primary />
        ) : activeWorkoutId === undefined ? (
          <ActivityIndicator accessibilityLabel="Laster aktiv økt" />
        ) : (
          <Action
            actionRef={startWorkoutRef}
            colors={colors}
            disabled={starting}
            label={starting ? 'Starter økt' : activeWorkoutId === null ? 'Start økt' : 'Fortsett økt'}
            onPress={() => void openWorkout()}
            primary
          />
        )}
        {error && <Text accessibilityRole="alert" style={{ color: colors.notification }}>Kunne ikke laste inn</Text>}
        <Action colors={colors} disabled={starting} label="Tidligere økter" onPress={() => navigation.navigate('History')} />
        <Action colors={colors} disabled={starting} label="Øvelser" onPress={() => navigation.navigate('Exercises')} />
      </View>
    </ScrollView>
  );
}

function Action({
  actionRef,
  colors,
  label,
  onPress,
  disabled = false,
  primary = false,
}: {
  actionRef?: React.RefObject<View | null>;
  colors: { background: string; border: string; primary: string; text: string };
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      ref={actionRef}
      style={({ pressed }) => [
        styles.action,
        { borderColor: primary ? colors.primary : colors.border },
        primary && { backgroundColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
  },
  introduction: {
    fontSize: 18,
    lineHeight: 27,
    marginTop: 12,
  },
  actions: {
    gap: 12,
    marginTop: 40,
  },
  action: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
