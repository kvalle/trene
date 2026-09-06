import { usePreventRemove } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, type Text as TextType } from 'react-native';

import { useDatabaseRuntime } from '../database/DatabaseContext';
import { deleteAllTrainingData } from '../database/trainingData';
import { typography } from '../theme';
import { useTrainingDataDeletionStatus } from '../trainingDataDeletion';
import { useAppTheme } from '../ui/AppThemeProvider';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { Notice } from '../ui/Notice';

const CONSEQUENCE = 'Alle treningsøkter, inkludert en eventuell aktiv økt, og alle øvelser slettes permanent. Lag en sikkerhetskopi først hvis du vil beholde dataene.';

export function DeleteTrainingDataScreen() {
  const runtime = useDatabaseRuntime();
  const { colors } = useAppTheme();
  const { reportDeleted } = useTrainingDataDeletionStatus();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState(false);
  const dialogTitleRef = useRef<TextType>(null);
  usePreventRemove(deleting, () => undefined);

  async function deleteData() {
    if (deleting) return;
    setDeleting(true);
    setFailure(false);
    try {
      await deleteAllTrainingData(runtime);
      reportDeleted();
    } catch {
      setConfirmationOpen(false);
      setFailure(true);
      const message = 'Kunne ikke slette treningsdataene. Dataene ble ikke endret.';
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>Slett treningsdata</Text>
      <Notice
        title="Dette kan ikke angres"
        message="Alle øvelser og treningsøkter slettes fra Trene. Sikkerhetskopier du allerede har eksportert, blir ikke slettet."
        testID="delete-training-data-notice"
      />
      {failure && (
        <ErrorAlert
          message="Kunne ikke slette treningsdataene. Dataene ble ikke endret."
          testID="delete-training-data-error"
        />
      )}
      <Button
        accessibilityHint="Åpner en bekreftelse før alle treningsdata slettes permanent"
        onPress={() => { setFailure(false); setConfirmationOpen(true); }}
        testID="open-delete-training-data-confirmation"
        title="Slett alle treningsdata"
        variant="destructive"
      />
      <Dialog
        initialFocusRef={dialogTitleRef}
        onRequestClose={() => { if (!deleting) setConfirmationOpen(false); }}
        testID="delete-training-data-confirmation"
        title="Slett alle treningsdata?"
        titleRef={dialogTitleRef}
        visible={confirmationOpen}
      >
        <Text style={[typography.body, { color: colors.text }]}>{CONSEQUENCE}</Text>
        <Button
          disabled={deleting}
          onPress={() => setConfirmationOpen(false)}
          testID="cancel-delete-training-data"
          title="Avbryt"
          variant="secondary"
        />
        <Button
          accessibilityHint="Sletter alle treningsdata permanent"
          busy={deleting}
          onPress={() => void deleteData()}
          testID="confirm-delete-training-data"
          title={deleting ? 'Sletter' : 'Slett alle data'}
          variant="destructive"
        />
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 24 },
});
