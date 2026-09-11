import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { useAppTheme } from '../ui/AppThemeProvider';
import { appearancePreferenceLabels } from '../preferences/appearancePreference';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { preference } = useAppTheme();
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
