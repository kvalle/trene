import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { radii, typography } from '../theme';
import { AppThemeProvider, useAppTheme } from '../ui/AppThemeProvider';
import { getAppStackScreenOptions } from '../ui/appShell';

type CatalogStackParamList = {
  Catalog: undefined;
  StackExample: undefined;
  ModalExample: undefined;
};

const Stack = createNativeStackNavigator<CatalogStackParamList>();

export default function ComponentCatalog() {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  return (
    <AppThemeProvider scheme={scheme}>
      <CatalogNavigator scheme={scheme} setScheme={setScheme} />
    </AppThemeProvider>
  );
}

function CatalogNavigator({ scheme, setScheme }: {
  scheme: 'light' | 'dark';
  setScheme: (scheme: 'light' | 'dark') => void;
}) {
  const { colors, navigation } = useAppTheme();
  return (
    <NavigationContainer theme={navigation}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={getAppStackScreenOptions(colors)}>
        <Stack.Screen name="Catalog" options={{ title: 'Komponentkatalog' }}>
          {(props) => <CatalogScreen {...props} scheme={scheme} setScheme={setScheme} />}
        </Stack.Screen>
        <Stack.Screen name="StackExample" component={StackExampleScreen} options={{ title: 'Stack' }} />
        <Stack.Screen name="ModalExample" component={ModalExampleScreen} options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function CatalogScreen({ navigation, scheme, setScheme }: NativeStackScreenProps<CatalogStackParamList, 'Catalog'> & {
  scheme: 'light' | 'dark';
  setScheme: (scheme: 'light' | 'dark') => void;
}) {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.catalog}>
      <Text style={[typography.metadata, { color: colors.muted }]}>TRENE DESIGNSYSTEM</Text>
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>Runtime-katalog</Text>
      <Text style={[typography.body, { color: colors.muted }]}>Produksjonstema og native app-shell i representative kontekster.</Text>
      <View style={[styles.themeControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.control, { color: colors.text }]}>Mørk modus</Text>
        <Switch accessibilityLabel="Mørk modus" onValueChange={(enabled) => setScheme(enabled ? 'dark' : 'light')} trackColor={{ false: colors.border, true: colors.primary }} value={scheme === 'dark'} />
      </View>
      <CatalogAction label="Vis native stack" onPress={() => navigation.navigate('StackExample')} />
      <CatalogAction label="Vis native modal" onPress={() => navigation.navigate('ModalExample')} />
      <View style={[styles.largeText, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Dynamisk tekst</Text>
        <Text style={[typography.body, { color: colors.muted }]}>Aktuell systemskala: {PixelRatio.getFontScale().toFixed(2)}×. Alle eksemplene bruker native tekstskalering.</Text>
      </View>
    </ScrollView>
  );
}

function StackExampleScreen() {
  return <ExampleScreen title="Native stack-header" />;
}

function ModalExampleScreen() {
  return <ExampleScreen title="Native modalpresentasjon" />;
}

function ExampleScreen({ title }: { title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.example}>
      <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.muted }]}>Denne ruten bruker samme navigator-tema og screen options som produksjonsappen.</Text>
    </View>
  );
}

function CatalogAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
      <Text style={[typography.control, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  catalog: { gap: 20, padding: 20, paddingBottom: 48 },
  themeControl: { alignItems: 'center', borderRadius: radii.container, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 16 },
  action: { alignItems: 'center', borderRadius: radii.control, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  largeText: { borderRadius: radii.container, gap: 10, padding: 20 },
  example: { gap: 12, padding: 24 },
  pressed: { opacity: 0.72 },
});
