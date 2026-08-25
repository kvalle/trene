import Constants from 'expo-constants';
import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createAndShareBackup } from '../backup/createBackup';
import { createNativeBackupPlatform } from '../backup/nativeBackupPlatform';
import { createNativeRestorePlatform } from '../backup/nativeRestorePlatform';
import { prepareRestore, RestorePreparationError, type PreparedRestore } from '../backup/prepareRestore';
import { RestoreCommitError } from '../backup/commitRestore';
import { nativeBackupRestoreFaultCheckpoint } from '../backup/nativeRestoreAutomation';
import { useDatabaseRuntime } from '../database/DatabaseContext';
import { formatDateTime } from '../locale';
import { typography } from '../theme';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataRow } from '../ui/DataRow';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Notice } from '../ui/Notice';

export function DataScreen() {
  const runtime = useDatabaseRuntime();
  const { colors } = useAppTheme();
  const [operation, setOperation] = useState<'idle' | 'backup' | 'restore' | 'commit'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [safeStop, setSafeStop] = useState(false);
  const [restore, setRestore] = useState<PreparedRestore | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [currentCounts, setCurrentCounts] = useState<PreparedRestore['previewCounts'] | null>(null);
  const restoreButtonRef = useRef<View>(null);
  const dialogActionRef = useRef<View>(null);
  const busy = operation !== 'idle';
  usePreventRemove(operation === 'commit', () => undefined);

  useEffect(() => () => restore?.cancel(), [restore]);

  async function createBackup() {
    setOperation('backup');
    setFailure(null);
    try {
      await createAndShareBackup(runtime, createNativeBackupPlatform(), {
        appVersion: Constants.expoConfig?.version ?? 'unknown',
        checkpoint: nativeBackupRestoreFaultCheckpoint,
      });
    } catch {
      setFailure('Kunne ikke lage sikkerhetskopien. Dataene dine er ikke endret.');
    } finally {
      setOperation('idle');
    }
  }

  async function selectRestore() {
    setOperation('restore');
    setFailure(null);
    setSafeStop(false);
    try {
      const result = await prepareRestore(createNativeRestorePlatform(), nativeBackupRestoreFaultCheckpoint);
      if (result.status === 'ready') setRestore(result.restore);
    } catch (error) {
      const message = error instanceof RestorePreparationError && error.code === 'update-required'
        ? 'Sikkerhetskopien krever en nyere versjon av Trene. Dataene dine er ikke endret.'
        : error instanceof RestorePreparationError && error.code === 'insufficient-storage'
          ? 'Det er ikke nok ledig plass til å kontrollere sikkerhetskopien. Dataene dine er ikke endret.'
          : 'Sikkerhetskopien er skadet eller kan ikke leses. Dataene dine er ikke endret.';
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setOperation('idle');
    }
  }

  function closePreview() {
    if (operation === 'commit') return;
    restore?.cancel();
    setRestore(null);
    setConfirmationOpen(false);
    setCurrentCounts(null);
    requestAnimationFrame(() => focus(restoreButtonRef));
  }

  async function continueRestore() {
    if (!restore || busy) return;
    setOperation('restore');
    setFailure(null);
    try {
      setCurrentCounts(await restore.currentCounts(runtime));
      setConfirmationOpen(true);
      requestAnimationFrame(() => focus(dialogActionRef));
    } catch {
      const message = 'Kunne ikke kontrollere dataene som skal erstattes. Dataene dine er ikke endret.';
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setOperation('idle');
    }
  }

  async function commitRestore() {
    if (!restore || operation !== 'idle') return;
    setOperation('commit');
    setFailure(null);
    try {
      const restored = await restore.commit(runtime);
      const message = `Gjenopprettet ${restored.workouts} treningsøkter og ${restored.exercises} øvelser.`;
      AccessibilityInfo.announceForAccessibility(message);
    } catch (error) {
      const message = error instanceof RestoreCommitError && error.code === 'unrecoverable'
        ? 'Gjenopprettingen kunne ikke fullføres trygt. Lukk Trene og behold appdataene for å kunne gjenopprette dem senere.'
        : 'Gjenopprettingen mislyktes. De opprinnelige dataene er kontrollert og gjenopprettet.';
      if (error instanceof RestoreCommitError && error.code === 'unrecoverable') {
        setSafeStop(true);
        setConfirmationOpen(false);
        setCurrentCounts(null);
      } else {
        restore.cancel();
        setRestore(null);
        setConfirmationOpen(false);
        setCurrentCounts(null);
      }
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setOperation('idle');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>Dine data</Text>
      <Text style={[typography.body, { color: colors.text }]}>Lag en fil med alle øvelser og treningsøkter i Trene.</Text>
      <Notice
        testID="data-notice"
        title="Filen inneholder treningsdata"
        message="Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte."
      />
      <Button
        testID="create-backup"
        disabled={busy}
        busy={operation === 'backup'}
        title={operation === 'backup' ? 'Lager sikkerhetskopi' : 'Lag sikkerhetskopi'}
        onPress={() => void createBackup()}
        style={styles.primaryAction}
      />
      <Button
        testID="restore-from-file"
        variant="secondary"
        disabled={busy}
        busy={operation === 'restore'}
        title={operation === 'restore' ? 'Kontrollerer sikkerhetskopi' : 'Gjenopprett fra fil'}
        onPress={() => void selectRestore()}
        ref={restoreButtonRef}
        style={styles.secondaryAction}
      />
      {failure && !safeStop && <ErrorAlert testID="data-error" message={failure} />}
      <Dialog
        initialFocusRef={dialogActionRef}
        onRequestClose={() => { if (!safeStop) closePreview(); }}
        testID={safeStop ? 'restore-safe-stop' : confirmationOpen ? 'restore-confirmation' : 'restore-preview'}
        title={safeStop ? 'Trene kan ikke åpne dataene trygt' : confirmationOpen ? 'Erstatt alle data?' : 'Kontroller sikkerhetskopien'}
        transparent
        visible={restore !== null}
      >
        {restore && (safeStop ? (
          <ErrorAlert message={failure ?? ''} />
        ) : <>
              {!confirmationOpen && <>
                <Text style={[typography.body, { color: colors.text }]}>Opprettet {formatDateTime(new Date(restore.createdAt))}</Text>
                <Card style={styles.counts}>
                  <DataRow label={`${restore.previewCounts.workouts} treningsøkter`} value="I sikkerhetskopien" />
                  <DataRow label={`${restore.previewCounts.exercises} øvelser`} value="I sikkerhetskopien" showSeparator />
                </Card>
                <Text style={[typography.body, { color: colors.text }]}>Ingenting er gjenopprettet ennå.</Text>
              </>}
              {confirmationOpen && currentCounts && <>
                <Text style={[typography.body, { color: colors.text }]}>Nåværende data som blir erstattet:</Text>
                <Card style={styles.counts}>
                  <DataRow label={`${currentCounts.workouts} treningsøkter`} value="I Trene nå" />
                  <DataRow label={`${currentCounts.exercises} øvelser`} value="I Trene nå" showSeparator />
                </Card>
                <Text style={[typography.body, { color: colors.text }]}>Sikkerhetskopien som gjenopprettes:</Text>
                <Card style={styles.counts}>
                  <DataRow label={`${restore.previewCounts.workouts} treningsøkter`} value="I sikkerhetskopien" />
                  <DataRow label={`${restore.previewCounts.exercises} øvelser`} value="I sikkerhetskopien" showSeparator />
                </Card>
                <Text style={[typography.control, { color: colors.danger }]}>Dette erstatter alle data i Trene og kan ikke angres.</Text>
              </>}
              <Button ref={dialogActionRef} disabled={operation === 'commit'} onPress={closePreview} testID="cancel-restore" title="Avbryt" variant="secondary" />
              {!confirmationOpen && <Button accessibilityHint="Åpner neste steg uten å endre data" busy={operation === 'restore'} onPress={() => void continueRestore()} testID="continue-restore" title={operation === 'restore' ? 'Kontrollerer nåværende data' : 'Fortsett'} />}
              {confirmationOpen && <Button accessibilityHint="Erstatter alle data i Trene og kan ikke angres" busy={operation === 'commit'} onPress={() => void commitRestore()} testID="confirm-restore" title={operation === 'commit' ? 'Gjenoppretter' : 'Erstatt og gjenopprett'} variant="destructive" />}
            </>
        )}
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 24 },
  primaryAction: { marginTop: 12 },
  secondaryAction: { marginTop: 0 },
  counts: { gap: 0, paddingVertical: 4 },
});

function focus(ref: React.RefObject<View | null>): void {
  const handle = findNodeHandle(ref.current);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}
