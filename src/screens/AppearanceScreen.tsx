import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { appearancePreferenceLabels, type AppearancePreference } from '../preferences/appearancePreference';
import { ErrorAlert } from '../ui/ErrorAlert';
import { FormSection } from '../ui/FormSection';
import { SingleSelectionGroup } from '../ui/SingleSelectionGroup';
import { useAppTheme } from '../ui/AppThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Appearance'>;

const options = (Object.entries(appearancePreferenceLabels) as [AppearancePreference, string][]).map(
  ([value, label]) => ({ value, label, testID: `appearance-${value}` }),
);

export function AppearanceScreen({ navigation }: Props) {
  const { changingPreference, preference, setPreference } = useAppTheme();
  const [failure, setFailure] = useState(false);
  const screenActive = useRef(true);

  useEffect(() => {
    const removeFocusListener = navigation.addListener('focus', () => { screenActive.current = true; });
    const removeBlurListener = navigation.addListener('blur', () => {
      screenActive.current = false;
      setFailure(false);
    });
    return () => {
      screenActive.current = false;
      removeFocusListener();
      removeBlurListener();
    };
  }, [navigation]);

  async function selectPreference(nextPreference: AppearancePreference) {
    setFailure(false);
    if (!await setPreference(nextPreference)) {
      if (screenActive.current) setFailure(true);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <FormSection title="Tema">
        <SingleSelectionGroup
          accessibilityLabel="Tema"
          options={options.map((option) => ({
            ...option,
            disabled: changingPreference,
            testID: option.value === preference ? `${option.testID}-selected` : option.testID,
          }))}
          value={preference}
          onValueChange={(value) => { void selectPreference(value); }}
          testID="appearance-options"
        />
      </FormSection>
      {failure ? (
        <ErrorAlert
          message="Det forrige valget er fortsatt aktivt. Prøv igjen."
          title="Kunne ikke lagre utseendet"
          testID="appearance-error"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
});
