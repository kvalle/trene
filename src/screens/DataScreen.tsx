import Constants from 'expo-constants';
import { usePreventRemove, useTheme } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createAndShareBackup } from '../backup/createBackup';
import { createNativeBackupPlatform } from '../backup/nativeBackupPlatform';
import { createNativeRestorePlatform } from '../backup/nativeRestorePlatform';
import { prepareRestore, RestorePreparationError, type PreparedRestore } from '../backup/prepareRestore';
import { RestoreCommitError } from '../backup/commitRestore';
import { nativeBackupRestoreFaultCheckpoint } from '../backup/nativeRestoreAutomation';
import { useDatabaseRuntime } from '../database/DatabaseContext';
import { formatDateTime } from '../locale';

export function DataScreen() {
  const runtime = useDatabaseRuntime();
  const { colors } = useTheme();
  const [operation, setOperation] = useState<'idle' | 'backup' | 'restore' | 'commit'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [safeStop, setSafeStop] = useState(false);
  const [restore, setRestore] = useState<PreparedRestore | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [currentCounts, setCurrentCounts] = useState<PreparedRestore['previewCounts'] | null>(null);
  const restoreButtonRef = useRef<View>(null);
  const previewRef = useRef<View>(null);
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
      requestAnimationFrame(() => focus(previewRef));
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
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Dine data</Text>
      <Text style={[styles.body, { color: colors.text }]}>Lag en fil med alle øvelser og treningsøkter i Trene.</Text>
      <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.noticeTitle, { color: colors.text }]}>Filen inneholder treningsdata</Text>
        <Text style={[styles.noticeText, { color: colors.text }]}>Sikkerhetskopien er ikke kryptert av Trene. Oppbevar og del den på en trygg måte.</Text>
      </View>
      <Pressable
        testID="create-backup"
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: operation === 'backup' }}
        disabled={busy}
        onPress={() => void createBackup()}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed, busy && styles.disabled]}
      >
        {operation === 'backup' && <ActivityIndicator color={colors.background} />}
        <Text style={[styles.actionText, { color: colors.background }]}>{operation === 'backup' ? 'Lager sikkerhetskopi' : 'Lag sikkerhetskopi'}</Text>
      </Pressable>
      <Pressable
        testID="restore-from-file"
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: operation === 'restore' }}
        disabled={busy}
        onPress={() => void selectRestore()}
        ref={restoreButtonRef}
        style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.primary }, pressed && styles.pressed, busy && styles.disabled]}
      >
        {operation === 'restore' && <ActivityIndicator color={colors.primary} />}
        <Text style={[styles.actionText, { color: colors.primary }]}>{operation === 'restore' ? 'Kontrollerer sikkerhetskopi' : 'Gjenopprett fra fil'}</Text>
      </Pressable>
      {failure && !safeStop && <Text accessibilityRole="alert" testID="data-error" style={[styles.error, { color: colors.notification }]}>{failure}</Text>}
      <Modal animationType="none" onRequestClose={() => { if (!safeStop) closePreview(); }} onShow={() => focus(previewRef)} transparent visible={restore !== null}>
        <View accessibilityViewIsModal style={styles.modalBackdrop}>
          {restore && <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            {safeStop ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: colors.notification }]}>{failure}</Text>
            ) : <>
              <Text accessibilityRole="header" ref={previewRef} testID={confirmationOpen ? 'restore-confirmation' : 'restore-preview'} style={[styles.dialogTitle, { color: colors.text }]}>{confirmationOpen ? 'Erstatt alle data?' : 'Kontroller sikkerhetskopien'}</Text>
              {!confirmationOpen && <>
                <Text style={[styles.previewText, { color: colors.text }]}>Opprettet {formatDateTime(new Date(restore.createdAt))}</Text>
                <Text style={[styles.previewCount, { color: colors.text }]}>{restore.previewCounts.workouts} treningsøkter</Text>
                <Text style={[styles.previewCount, { color: colors.text }]}>{restore.previewCounts.exercises} øvelser</Text>
                <Text style={[styles.previewText, { color: colors.text }]}>Ingenting er gjenopprettet ennå.</Text>
              </>}
              {confirmationOpen && currentCounts && <>
                <Text style={[styles.previewText, { color: colors.text }]}>Nåværende data som blir erstattet:</Text>
                <Text style={[styles.previewCount, { color: colors.text }]}>{currentCounts.workouts} treningsøkter og {currentCounts.exercises} øvelser</Text>
                <Text style={[styles.previewText, { color: colors.text }]}>Sikkerhetskopien som gjenopprettes:</Text>
                <Text style={[styles.previewCount, { color: colors.text }]}>{restore.previewCounts.workouts} treningsøkter og {restore.previewCounts.exercises} øvelser</Text>
                <Text style={[styles.warning, { color: colors.notification }]}>Dette erstatter alle data i Trene og kan ikke angres.</Text>
              </>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: operation === 'commit' }} disabled={operation === 'commit'} onPress={closePreview} testID="cancel-restore" style={[styles.secondaryAction, { borderColor: colors.primary }, operation === 'commit' && styles.disabled]}>
                <Text style={[styles.actionText, { color: colors.primary }]}>Avbryt</Text>
              </Pressable>
              {!confirmationOpen && <Pressable accessibilityRole="button" accessibilityHint="Åpner neste steg uten å endre data" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void continueRestore()} testID="continue-restore" style={[styles.action, { backgroundColor: colors.primary }, busy && styles.disabled]}>
                <Text style={[styles.actionText, { color: colors.background }]}>{operation === 'restore' ? 'Kontrollerer nåværende data' : 'Fortsett'}</Text>
              </Pressable>}
              {confirmationOpen && <Pressable accessibilityRole="button" accessibilityHint="Erstatter alle data i Trene og kan ikke angres" accessibilityState={{ disabled: operation === 'commit', busy: operation === 'commit' }} disabled={operation === 'commit'} onPress={() => void commitRestore()} testID="confirm-restore" style={[styles.destructiveAction, { backgroundColor: colors.notification }, operation === 'commit' && styles.disabled]}>
                {operation === 'commit' && <ActivityIndicator color={colors.background} />}
                <Text style={[styles.actionText, { color: colors.background }]}>{operation === 'commit' ? 'Gjenoppretter' : 'Erstatt og gjenopprett'}</Text>
              </Pressable>}
            </>}
          </View>}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  heading: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 18, lineHeight: 27, marginTop: 12 },
  notice: { borderRadius: 14, borderWidth: 1, marginTop: 28, padding: 18 },
  noticeTitle: { fontSize: 17, fontWeight: '700' },
  noticeText: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  action: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 24, minHeight: 54, paddingHorizontal: 20 },
  secondaryAction: { alignItems: 'center', borderRadius: 14, borderWidth: 2, flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 16, minHeight: 54, paddingHorizontal: 20 },
  actionText: { fontSize: 18, fontWeight: '700' },
  error: { fontSize: 16, lineHeight: 24, marginTop: 16 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.7 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 18, maxWidth: 440, padding: 22, width: '100%' },
  dialogTitle: { fontSize: 24, fontWeight: '700' },
  previewText: { fontSize: 16, lineHeight: 24, marginTop: 12 },
  previewCount: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  warning: { fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 18 },
  destructiveAction: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 16, minHeight: 54, paddingHorizontal: 20 },
});

function focus(ref: React.RefObject<View | null>): void {
  const handle = findNodeHandle(ref.current);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}
