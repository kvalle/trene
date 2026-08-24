import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { RootStackParamList } from '../AppNavigator';
import { typography } from '../theme';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { useAppTheme } from '../ui/AppThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[typography.screenTitle, styles.heading, { color: colors.text }]}>Innstillinger</Text>
      <ListContainer>
        <NavigationRow
          onPress={() => navigation.navigate('Data')}
          testID="settings-data"
          title="Data"
        />
      </ListContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 20, padding: 20 },
  heading: { marginTop: 4 },
});
