import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { DatabaseProvider } from './database/DatabaseContext';
import type { Database } from './database/types';
import { darkTheme, lightTheme } from './theme';

type StartupState =
  | { status: 'loading' }
  | { status: 'failed'; failures: number }
  | { status: 'ready'; database: Database };

export function StartupGate({
  children,
  openDatabase,
}: {
  children: React.ReactNode;
  openDatabase: () => Promise<Database>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StartupState>({ status: 'loading' });
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkTheme.colors : lightTheme.colors;
  const retryRef = useRef<View>(null);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    openDatabase().then(
      (database) => {
        if (active) setState({ status: 'ready', database });
        else void database.closeAsync();
      },
      () => {
        if (active) setState({ status: 'failed', failures: attempt + 1 });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, openDatabase]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  if (state.status === 'ready') {
    return <DatabaseProvider database={state.database}>{children}</DatabaseProvider>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: colors.background }}
    >
      <Text style={[styles.brand, { color: colors.text }]}>Trene</Text>
      {state.status === 'loading' ? (
        <ActivityIndicator accessibilityLabel="Starter Trene" color={colors.primary} size="large" />
      ) : (
        <View accessibilityLiveRegion="assertive" style={styles.failure}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
            Trene kunne ikke starte
          </Text>
          <Text style={[styles.message, { color: colors.text }]}>
            Dataene dine er ikke endret. Prøv å starte på nytt.
          </Text>
          {state.failures > 1 && (
            <Text style={[styles.message, { color: colors.text }]}>
              Hvis problemet fortsetter, avslutt appen helt og åpne den igjen.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}
            ref={retryRef}
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryText, { color: colors.background }]}>Prøv igjen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: { fontSize: 36, fontWeight: '800', marginBottom: 32 },
  failure: { alignItems: 'center', maxWidth: 440 },
  heading: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 17, lineHeight: 25, marginTop: 16, textAlign: 'center' },
  retry: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
    paddingHorizontal: 24,
  },
  retryText: { fontSize: 18, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
