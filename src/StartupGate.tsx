import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DatabaseProvider } from './database/DatabaseContext';
import { DatabaseRuntime } from './database/DatabaseRuntime';
import type { Database } from './database/types';
import { useAppTheme } from './ui/AppThemeProvider';
import { Loader } from './ui/Loader';
import { PageStatus } from './ui/PageStatus';
import { cleanupAbandonedBackupExports } from './backup/nativeBackupPlatform';
import {
  cleanupAbandonedRestorePreparations,
  createNativeRestoreRecoveryPlatform,
} from './backup/nativeRestorePlatform';
import { recoverInterruptedRestore, RestoreSafeStopError } from './backup/recoverRestore';
import { nativeBackupRestoreFaultCheckpoint } from './backup/nativeRestoreAutomation';

type StartupState =
  | { status: 'loading' }
  | { status: 'failed'; failures: number }
  | { status: 'safe-stop' }
  | { status: 'ready'; runtime: DatabaseRuntime };

export function StartupGate({
  children,
  openDatabase,
}: {
  children: React.ReactNode;
  openDatabase: () => Promise<Database>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StartupState>({ status: 'loading' });
  const [runtime] = useState(() => new DatabaseRuntime(openDatabase));
  const { colors } = useAppTheme();
  const retryRef = useRef<View>(null);
  const recoveryCleanup = useRef<null | (() => void)>(null);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    cleanupAbandonedBackupExports()
      .then(() => recoverInterruptedRestore(
        createNativeRestoreRecoveryPlatform(),
        nativeBackupRestoreFaultCheckpoint,
      ))
      .then((cleanup) => { recoveryCleanup.current = cleanup; })
      .then(() => runtime.start()).then(
      () => {
        if (active) setState({ status: 'ready', runtime });
        else void runtime.close();
      },
      (error) => {
        if (error instanceof RestoreSafeStopError
          && process.env.EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION === '1') {
          console.warn(`Restore recovery safe stop phase: ${error.phase}`);
        }
        if (active) setState(error instanceof RestoreSafeStopError
          ? { status: 'safe-stop' }
          : { status: 'failed', failures: attempt + 1 });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, runtime]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const cleanup = recoveryCleanup.current;
    recoveryCleanup.current = null;
    try {
      cleanup?.();
    } catch {
      // A later startup can retry cleanup after the verified database is active.
    }
    void cleanupAbandonedRestorePreparations().catch(() => undefined);
  }, [state.status]);

  useEffect(() => () => {
    void runtime.close();
  }, [runtime]);

  useEffect(() => {
    if (state.status !== 'failed') return;
    const handle = findNodeHandle(retryRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [state.status]);

  if (state.status === 'ready') {
    return <DatabaseProvider database={state.runtime}>{children}</DatabaseProvider>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: colors.background }}
    >
      <Text style={[styles.brand, { color: colors.text }]}>Trene</Text>
      {state.status === 'loading' ? (
        <PageStatus
          variant="loading"
          loaderLabel="Starter Trene"
          testID="startup-loading"
        />
      ) : state.status === 'safe-stop' ? (
        <PageStatus
          variant="safe-stop"
          title="Trene kan ikke åpne dataene trygt"
          message="Gjenopprettingen ble avbrutt, og ingen av databasene kunne bekreftes. Dataene er bevart for hjelp med gjenoppretting."
          secondaryMessage="Ikke slett eller installer appen på nytt."
          testID="startup-safe-stop"
        />
      ) : (
        <PageStatus
          variant="error"
          title="Trene kunne ikke starte"
          message="Dataene dine er ikke endret. Prøv å starte på nytt."
          secondaryMessage={state.failures > 1 ? 'Hvis problemet fortsetter, avslutt appen helt og åpne den igjen.' : undefined}
          actionTitle="Prøv igjen"
          onAction={() => setAttempt((value) => value + 1)}
          actionTestID="startup-retry"
          actionRef={retryRef}
          testID="startup-error"
        />
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
});
