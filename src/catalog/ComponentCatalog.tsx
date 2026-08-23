import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { radii, typography } from '../theme';
import { AppThemeProvider, useAppTheme } from '../ui/AppThemeProvider';
import { getAppStackScreenOptions } from '../ui/appShell';
import { Button } from '../ui/Button';
import { FieldError } from '../ui/FieldError';
import { TextField } from '../ui/TextField';

type CatalogStackParamList = {
  Overview: undefined;
  ButtonDetail: undefined;
  TextFieldDetail: undefined;
  FieldErrorDetail: undefined;
  AppShellDetail: undefined;
  StackExample: undefined;
  ModalExample: undefined;
};

const Stack = createNativeStackNavigator<CatalogStackParamList>();

type CatalogGroup = {
  title: string;
  items: CatalogItem[];
};

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  usage: string;
  route: keyof CatalogStackParamList;
  testID: string;
};

// Only implemented components in src/ui/ per ticket scope.
// Theme/app-shell is represented as Navigasjon og struktur entry.
const CATALOG_GROUPS: CatalogGroup[] = [
  {
    title: 'Handlinger',
    items: [
      {
        id: 'button',
        name: 'Button',
        description: 'Primær, sekundær, tekst og destruktiv handling med tydelig hierarki.',
        usage: 'Bruk én primær handling per kontekst. Sekundær og tekst brukes for støttehandlinger, destruktiv for irreversible valg.',
        route: 'ButtonDetail',
        testID: 'catalog-item-button',
      },
    ],
  },
  {
    title: 'Skjema',
    items: [
      {
        id: 'textfield',
        name: 'TextField',
        description: 'Lar brukeren skrive inn kort, fritt innhold.',
        usage: 'Bruk når brukeren må opprette eller endre tekst som navn og etiketter.',
        route: 'TextFieldDetail',
        testID: 'catalog-item-textfield',
      },
      {
        id: 'fielderror',
        name: 'FieldError',
        description: 'Feilkant og forklarende tekst knyttet til feltet.',
        usage: 'Bruk når ett bestemt felt inneholder en feil brukeren kan rette direkte.',
        route: 'FieldErrorDetail',
        testID: 'catalog-item-fielderror',
      },
    ],
  },
  {
    title: 'Navigasjon og struktur',
    items: [
      {
        id: 'appshell',
        name: 'App-shell',
        description: 'Native stack og modal med delt tema og navigasjonsoppsett.',
        usage: 'Bruk samme app-shell og navigator-tema som produksjonsappen for konsistent header, bakgrunn og overganger.',
        route: 'AppShellDetail',
        testID: 'catalog-item-appshell',
      },
    ],
  },
];

export default function ComponentCatalog() {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  return (
    <AppThemeProvider scheme={scheme}>
      <CatalogNavigator scheme={scheme} setScheme={setScheme} />
    </AppThemeProvider>
  );
}

function CatalogNavigator({
  scheme,
  setScheme,
}: {
  scheme: 'light' | 'dark';
  setScheme: (s: 'light' | 'dark') => void;
}) {
  const { colors, navigation } = useAppTheme();
  return (
    <NavigationContainer theme={navigation}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={getAppStackScreenOptions(colors)}>
        <Stack.Screen name="Overview" options={{ title: 'Komponentbibliotek' }}>
          {(props) => <OverviewScreen {...props} scheme={scheme} setScheme={setScheme} />}
        </Stack.Screen>
        <Stack.Screen name="ButtonDetail" component={ButtonDetailScreen} options={{ title: 'Button' }} />
        <Stack.Screen name="TextFieldDetail" component={TextFieldDetailScreen} options={{ title: 'TextField' }} />
        <Stack.Screen name="FieldErrorDetail" component={FieldErrorDetailScreen} options={{ title: 'FieldError' }} />
        <Stack.Screen name="AppShellDetail" component={AppShellDetailScreen} options={{ title: 'App-shell' }} />
        <Stack.Screen name="StackExample" component={StackExampleScreen} options={{ title: 'Stack' }} />
        <Stack.Screen name="ModalExample" component={ModalExampleScreen} options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function OverviewScreen({
  navigation,
  scheme,
  setScheme,
}: NativeStackScreenProps<CatalogStackParamList, 'Overview'> & {
  scheme: 'light' | 'dark';
  setScheme: (s: 'light' | 'dark') => void;
}) {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.catalog} testID="catalog-overview">
      <Text style={[typography.metadata, { color: colors.muted }]}>TRENE DESIGNSYSTEM</Text>
      <Text accessibilityRole="header" style={[typography.screenTitle, { color: colors.text }]}>
        Komponentbibliotek
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>
        Oversikt over implementerte komponenter og deres varianter. Velg en komponent for detaljer og tilstander.
      </Text>

      <View style={[styles.themeControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.control, { color: colors.text }]}>Mørk modus</Text>
        <Switch
          accessibilityLabel="Mørk modus"
          onValueChange={(enabled) => setScheme(enabled ? 'dark' : 'light')}
          trackColor={{ false: colors.border, true: colors.primary }}
          value={scheme === 'dark'}
        />
      </View>

      <View style={[styles.largeText, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Dynamisk tekst</Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          Aktuell systemskala: {PixelRatio.getFontScale().toFixed(2)}×. Alle eksemplene bruker native tekstskalering.
        </Text>
      </View>

      {CATALOG_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text accessibilityRole="header" style={[typography.metadata, styles.groupTitle, { color: colors.muted }]}>
            {group.title.toUpperCase()}
          </Text>
          <View style={[styles.groupList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {group.items.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                testID={item.testID}
                onPress={() => navigation.navigate(item.route as never)}
                style={({ pressed }) => [
                  styles.groupItem,
                  index < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <View style={styles.groupItemText}>
                  <Text style={[typography.control, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[typography.metadata, { color: colors.muted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function DetailHeader({ name, description, usage }: { name: string; description: string; usage: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.detailHeader}>
      <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>
        {name}
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>{description}</Text>
      <View style={[styles.usageBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.text, fontWeight: '700' }]}>Bruk når</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>{usage}</Text>
      </View>
    </View>
  );
}

function ButtonDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-button">
      <DetailHeader
        name="Button"
        description="Primær, sekundær, tekst og destruktiv handling med tydelig hierarki. Deaktivert og opptatt er tilstander, ikke egne varianter."
        usage="Bruk én primær handling per kontekst. Sekundær og tekst brukes for støttehandlinger, destruktiv for irreversible valg."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Varianter × tilstander</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Hver variant vises i normal, deaktivert og opptatt tilstand. Deaktivert fjerner fargesignal for å unngå falskt hierarki.
        </Text>

        <ButtonVariantGroup
          title="Primær"
          hint="Den viktigste handlingen i gjeldende kontekst."
          variant="primary"
          labels={{ normal: 'Lagre', disabled: 'Lagre', busy: 'Lagrer…' }}
        />
        <ButtonVariantGroup
          title="Sekundær"
          hint="Overflatefarget støttehandling med nøytral kant."
          variant="secondary"
          labels={{ normal: 'Se detaljer', disabled: 'Se detaljer', busy: 'Laster…' }}
        />
        <ButtonVariantGroup
          title="Tekst"
          hint="Laveste nivå, for avbryt eller sekundære valg uten å konkurrere visuelt."
          variant="text"
          labels={{ normal: 'Avbryt', disabled: 'Avbryt', busy: 'Avbryter…' }}
        />
        <ButtonVariantGroup
          title="Destruktiv"
          hint="Permanent sletting eller erstatning med tydelig fare-signal."
          variant="destructive"
          labels={{ normal: 'Slett', disabled: 'Slett', busy: 'Sletter…' }}
        />
      </View>
    </ScrollView>
  );
}

function ButtonVariantGroup({
  title,
  hint,
  variant,
  labels,
}: {
  title: string;
  hint: string;
  variant: 'primary' | 'secondary' | 'text' | 'destructive';
  labels: { normal: string; disabled: string; busy: string };
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.variantGroup}>
      <Text style={[typography.control, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.metadata, { color: colors.muted }]}>{hint}</Text>
      <View style={styles.variantRow}>
        <View style={styles.variantCell}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Normal</Text>
          <Button title={labels.normal} variant={variant} onPress={() => {}} testID={`catalog-button-${variant}`} />
        </View>
        <View style={styles.variantCell}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Deaktivert</Text>
          <Button
            title={labels.disabled}
            variant={variant}
            disabled
            onPress={() => {}}
            testID={`catalog-button-${variant}-disabled`}
          />
        </View>
        <View style={styles.variantCell}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Opptatt</Text>
          <Button
            title={labels.busy}
            variant={variant}
            busy
            onPress={() => {}}
            testID={`catalog-button-${variant}-busy`}
          />
        </View>
      </View>
    </View>
  );
}

function TextFieldDetailScreen() {
  const { colors } = useAppTheme();
  const [value, setValue] = useState('Eksempelverdi');
  const focusRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => focusRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-textfield">
      <DetailHeader
        name="TextField"
        description="Lar brukeren skrive inn kort, fritt innhold."
        usage="Bruk når brukeren må opprette eller endre tekst som navn og etiketter."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Tilstander</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Generiske eksempler med nøytral etikett og innhold. Feltfeil vises via FieldError under feltet.
        </Text>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Normal</Text>
          <TextField
            label="Etikett"
            value={value}
            onChangeText={setValue}
            placeholder="Skriv inn tekst"
            testID="catalog-textfield-normal"
          />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Feil</Text>
          <TextField
            label="Etikett"
            value={value}
            onChangeText={setValue}
            error="Skriv inn en gyldig verdi"
            testID="catalog-textfield-error"
          />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Deaktivert</Text>
          <TextField
            label="Etikett"
            value={value}
            onChangeText={setValue}
            editable={false}
            testID="catalog-textfield-disabled"
          />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Fokus (trykk for å se)</Text>
          <TextField
            ref={focusRef}
            label="Etikett"
            value={value}
            onChangeText={setValue}
            placeholder="Fokus-tilstand"
            testID="catalog-textfield-focus"
          />
          <Text style={[typography.metadata, { color: colors.muted }]}>
            Feltet får fokus automatisk ved åpning — eller trykk for å se fokusring (rammefarge {colors.focus}).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function FieldErrorDetailScreen() {
  const { colors } = useAppTheme();
  const [value] = useState('Eksempelverdi');
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-fielderror">
      <DetailHeader
        name="FieldError"
        description="Feilkant og forklarende tekst knyttet til feltet."
        usage="Bruk når ett bestemt felt inneholder en feil brukeren kan rette direkte."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Varianter</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Generisk feilmelding uten domenekobling. Vises med farefarge, men farge er aldri eneste signal — teksten bærer betydningen.
        </Text>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Isolert</Text>
          <View style={[styles.errorPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <FieldError message="Skriv inn en gyldig verdi" testID="catalog-fielderror-isolated" />
          </View>
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>
            Sammen med TextField
          </Text>
          <TextField
            label="Etikett"
            value={value}
            onChangeText={() => {}}
            error="Skriv inn en gyldig verdi"
            testID="catalog-fielderror-with-field"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function AppShellDetailScreen({ navigation }: NativeStackScreenProps<CatalogStackParamList, 'AppShellDetail'>) {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-appshell">
      <DetailHeader
        name="App-shell"
        description="Native stack og modal med delt tema og navigasjonsoppsett via getAppStackScreenOptions."
        usage="Bruk samme app-shell og navigator-tema som produksjonsappen for konsistent header, bakgrunn og overganger."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Eksempler</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Begge bruker samme navigator-tema (colors.background / surface / text / border) og samme screen options som
          produksjonsappen.
        </Text>
        <View style={styles.controlGroup}>
          <CatalogAction label="Vis native stack" onPress={() => navigation.navigate('StackExample')} testID="catalog-appshell-stack" />
          <CatalogAction label="Vis native modal" onPress={() => navigation.navigate('ModalExample')} testID="catalog-appshell-modal" />
        </View>
      </View>

      <View style={[styles.largeText, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Dynamisk tekst</Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          Aktuell systemskala: {PixelRatio.getFontScale().toFixed(2)}×. Alle eksemplene bruker native tekstskalering.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Tema</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Lys og mørk modus toggles fra oversikten (Mørk modus-bryteren). Tema leveres via AppThemeProvider og getTheme — ingen
          farger dupliseres i katalogen.
        </Text>
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
      <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.muted }]}>
        Denne ruten bruker samme navigator-tema og screen options som produksjonsappen.
      </Text>
    </View>
  );
}

function CatalogAction({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, pressed && styles.pressed]}
    >
      <Text style={[typography.control, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  catalog: { gap: 20, padding: 20, paddingBottom: 48 },
  themeControl: {
    alignItems: 'center',
    borderRadius: radii.container,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  action: {
    alignItems: 'center',
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  largeText: { borderRadius: radii.container, gap: 10, padding: 20 },
  section: { borderRadius: radii.container, borderWidth: 1, gap: 16, padding: 16 },
  controlGroup: { gap: 8 },
  example: { gap: 12, padding: 24 },
  pressed: { opacity: 0.72 },
  group: { gap: 8 },
  groupTitle: { letterSpacing: 0.8 },
  groupList: { borderRadius: radii.container, borderWidth: 1, overflow: 'hidden' },
  groupItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupItemText: { flex: 1, gap: 4, paddingRight: 12 },
  chevron: { fontSize: 22, fontWeight: '400' },
  detail: { gap: 20, padding: 20, paddingBottom: 48 },
  detailHeader: { gap: 10 },
  usageBox: { borderRadius: radii.container, borderWidth: 1, gap: 6, padding: 12 },
  variantGroup: { gap: 8, paddingTop: 8 },
  variantRow: { gap: 12 },
  variantCell: { gap: 6 },
  variantLabel: { fontWeight: '600' },
  errorPreview: { borderRadius: radii.control, borderWidth: 1, padding: 12 },
});
