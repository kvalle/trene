import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { useAppTheme } from '../ui/AppThemeProvider';
import { appearancePreferenceLabels } from '../preferences/appearancePreference';
import { useActiveWorkoutVisibility } from '../activeWorkoutVisibility/ActiveWorkoutVisibilityContext';
import { activeWorkoutVisibilityLabels } from '../preferences/activeWorkoutVisibilityPreference';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { preference } = useAppTheme();
  const { preference: visibilityPreference } = useActiveWorkoutVisibility();
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <ListContainer>
        <NavigationRow
          metadata={appearancePreferenceLabels[preference]}
          onPress={() => navigation.navigate('Appearance')}
          showSeparator
          testID="settings-appearance"
          title="Utseende"
        />
        <NavigationRow
          metadata={visibilityPreference ? activeWorkoutVisibilityLabels[visibilityPreference] : 'Laster'}
          onPress={() => navigation.navigate('ActiveWorkoutVisibility')}
          showSeparator
          testID="settings-active-workout-visibility"
          title="Aktiv trening i systemet"
        />
        <NavigationRow
          onPress={() => navigation.navigate('Data')}
          testID="settings-data"
          title="Dine data"
        />
      </ListContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
});
