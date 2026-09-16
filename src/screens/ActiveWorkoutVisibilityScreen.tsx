import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { useActiveWorkoutVisibility } from '../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';
import {
  activeWorkoutVisibilityLabels,
  type ActiveWorkoutVisibilityPreference,
} from '../preferences/activeWorkoutVisibilityPreference';
import { Button } from '../ui/Button';
import { ErrorAlert } from '../ui/ErrorAlert';
import { FormSection } from '../ui/FormSection';
import { Notice } from '../ui/Notice';
import { SingleSelectionGroup } from '../ui/SingleSelectionGroup';
import type { SingleSelectionOption } from '../ui/SingleSelectionGroup';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveWorkoutVisibility'>;

const options: SingleSelectionOption<ActiveWorkoutVisibilityPreference>[] =
  (Object.entries(activeWorkoutVisibilityLabels) as [ActiveWorkoutVisibilityPreference, string][])
  .map(([value, label]) => ({ value, label, testID: `active-workout-visibility-${value}` }));

export function ActiveWorkoutVisibilityScreen({ navigation }: Props) {
  const {
    capability,
    changingPreference,
    openSystemSettings,
    preference,
    reconcile,
    setPreference,
  } = useActiveWorkoutVisibility();
  const [failure, setFailure] = useState<'save' | 'settings' | null>(null);
  const screenActive = useRef(true);

  useEffect(() => {
    const removeFocusListener = navigation.addListener('focus', () => {
      screenActive.current = true;
      void reconcile();
    });
    const removeBlurListener = navigation.addListener('blur', () => {
      screenActive.current = false;
      setFailure(null);
    });
    return () => {
      screenActive.current = false;
      removeFocusListener();
      removeBlurListener();
    };
  }, [navigation, reconcile]);

  async function selectPreference(nextPreference: ActiveWorkoutVisibilityPreference) {
    setFailure(null);
    if (!await setPreference(nextPreference) && screenActive.current) setFailure('save');
  }

  async function openSettings() {
    setFailure(null);
    if (!await openSystemSettings() && screenActive.current) setFailure('settings');
  }

  const unsupported = capability?.supported === false;
  const unavailable = capability?.supported && !capability.canShow;
  const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const indicatorName = Platform.OS === 'ios' ? 'direkteaktivitet' : 'varsel';
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <FormSection title="Synlighet">
        <SingleSelectionGroup
          accessibilityLabel="Notifikasjoner"
          options={options.map((option) => ({
            ...option,
            disabled: changingPreference || preference === undefined,
            testID: option.value === preference ? `${option.testID}-selected` : option.testID,
          }))}
          value={preference ?? 'enabled'}
          onValueChange={(value) => { void selectPreference(value); }}
          testID="active-workout-visibility-options"
        />
      </FormSection>
      <Notice
        title={unsupported
          ? 'Ikke tilgjengelig'
          : unavailable
          ? Platform.OS === 'ios' ? 'Direkteaktiviteter er slått av' : 'Varsler er slått av'
          : 'Viser bare at trening pågår'}
        message={unsupported
          ? 'Denne enheten støtter ikke visning av aktiv trening i systemet.'
          : unavailable
          ? `Valget ditt er lagret, men ${platformName} tillater ikke at Trene viser ${indicatorName}. Du kan endre dette i systeminnstillingene.`
          : `Så lenge en treningsøkt er aktiv vises ${indicatorName}en «Trening pågår». Ingen info om øvelser eller sett blir vist.`}
        testID="active-workout-visibility-notice"
      />
      {unavailable && capability.supported ? (
        <Button
          onPress={() => { void openSettings(); }}
          testID="active-workout-visibility-open-settings"
          title="Åpne systeminnstillinger"
          variant="secondary"
        />
      ) : null}
      {failure ? (
        <ErrorAlert
          message={failure === 'save'
            ? 'Det forrige valget er fortsatt aktivt. Prøv igjen.'
            : `Åpne innstillingene for Trene manuelt fra ${platformName}-innstillingene.`}
          title={failure === 'save' ? 'Kunne ikke lagre valget' : 'Kunne ikke åpne systeminnstillinger'}
          testID="active-workout-visibility-error"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
});
