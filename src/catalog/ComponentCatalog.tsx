import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { radii, typography } from '../theme';
import { AppThemeProvider, useAppTheme } from '../ui/AppThemeProvider';
import { getAppStackScreenOptions } from '../ui/appShell';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataRow } from '../ui/DataRow';
import { Dialog } from '../ui/Dialog';
import { ErrorAlert } from '../ui/ErrorAlert';
import { FieldError } from '../ui/FieldError';
import { Hero } from '../ui/Hero';
import { Loader } from '../ui/Loader';
import { ListContainer } from '../ui/ListContainer';
import { NavigationRow } from '../ui/NavigationRow';
import { PageStatus } from '../ui/PageStatus';
import { SearchField } from '../ui/SearchField';
import { SelectionRow } from '../ui/SelectionRow';
import { TextField } from '../ui/TextField';

type CatalogStackParamList = {
  Overview: undefined;
  ButtonDetail: undefined;
  CardDetail: undefined;
  DataRowDetail: undefined;
  DialogDetail: undefined;
  TextFieldDetail: undefined;
  FieldErrorDetail: undefined;
  AppShellDetail: undefined;
  HeroDetail: undefined;
  LoaderDetail: undefined;
  ErrorAlertDetail: undefined;
  PageStatusDetail: undefined;
  ListContainerDetail: undefined;
  NavigationRowDetail: undefined;
  SearchFieldDetail: undefined;
  SelectionRowDetail: undefined;
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
      {
        id: 'dialog',
        name: 'Dialog',
        description: 'Modal beholder for bekreftelse og destruktive handlinger.',
        usage: 'Bruk når brukeren må ta stilling før den underliggende skjermen kan brukes videre.',
        route: 'DialogDetail',
        testID: 'catalog-item-dialog',
      },
    ],
  },
  {
    title: 'Lister og beholdere',
    items: [
      {
        id: 'card',
        name: 'Card',
        description: 'Overflate som grupperer relatert innhold.',
        usage: 'Bruk når en avgrenset oppsummering eller gruppe trenger felles flate og kant.',
        route: 'CardDetail',
        testID: 'catalog-item-card',
      },
      {
        id: 'datarow',
        name: 'DataRow',
        description: 'Statisk etikett og verdi i en dataliste.',
        usage: 'Bruk når lesbart, ikke-redigerbart data skal oppsummeres i en gruppe.',
        route: 'DataRowDetail',
        testID: 'catalog-item-datarow',
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
      {
        id: 'hero',
        name: 'Hero',
        description: 'Romslig startside med én tydelig hovedoppgave og få alternativer.',
        usage: 'Bruk når skjermen er et startpunkt med én dominerende handling og få sekundære valg.',
        route: 'HeroDetail',
        testID: 'catalog-item-hero',
      },
      {
        id: 'listcontainer',
        name: 'ListContainer',
        description: 'Grupperer relaterte rader med felles kant, avrunding og skillelinjer.',
        usage: 'Bruk når flere relaterte rader skal oppleves som én samling.',
        route: 'ListContainerDetail',
        testID: 'catalog-item-listcontainer',
      },
      {
        id: 'navigationrow',
        name: 'NavigationRow',
        description: 'Trykkbar rad med tittel, valgfri beskrivelse og pil.',
        usage: 'Bruk når hele raden åpner en ny skjerm.',
        route: 'NavigationRowDetail',
        testID: 'catalog-item-navigationrow',
      },
      {
        id: 'searchfield',
        name: 'SearchField',
        description: 'Filtrerer en liste fortløpende med fokusmarkering og søketastatur.',
        usage: 'Bruk når en liste kan bli lang nok til at visuell skanning ikke er effektiv.',
        route: 'SearchFieldDetail',
        testID: 'catalog-item-searchfield',
      },
      {
        id: 'selectionrow',
        name: 'SelectionRow',
        description: 'Trykkbar rad for å velge ett element, med valgfri fremdrift i etterfølgende plass.',
        usage: 'Bruk når brukeren skal velge ett eksisterende element fra en liste uten å navigere videre.',
        route: 'SelectionRowDetail',
        testID: 'catalog-item-selectionrow',
      },
    ],
  },
  {
    title: 'Feedback',
    items: [
      {
        id: 'loader',
        name: 'Loader',
        description: 'Aktivitetsindikator i stor sidevariant og kompakt inline-variant.',
        usage: 'Bruk stor loader når hovedinnholdet venter. Bruk kompakt loader i knapper, rader eller lokale operasjoner.',
        route: 'LoaderDetail',
        testID: 'catalog-item-loader',
      },
      {
        id: 'erroralert',
        name: 'ErrorAlert',
        description: 'Lokal feilmelding med fareikon, svak fareflate og valgfri gjenopprettingshandling.',
        usage: 'Bruk når en avgrenset operasjon feiler, mens resten av skjermen fortsatt er gyldig.',
        route: 'ErrorAlertDetail',
        testID: 'catalog-item-erroralert',
      },
    ],
  },
  {
    title: 'Sidevisninger',
    items: [
      {
        id: 'pagestatus',
        name: 'PageStatus',
        description: 'Sentrert sideoppsett for lasting, feil, tomt innhold og sikkerhetsstopp.',
        usage: 'Bruk når skjermens hovedinnhold ikke kan vises. Velg variant etter om brukeren venter, kan prøve igjen eller må stoppe.',
        route: 'PageStatusDetail',
        testID: 'catalog-item-pagestatus',
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
        <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ title: 'Card' }} />
        <Stack.Screen name="DataRowDetail" component={DataRowDetailScreen} options={{ title: 'DataRow' }} />
        <Stack.Screen name="DialogDetail" component={DialogDetailScreen} options={{ title: 'Dialog' }} />
        <Stack.Screen name="TextFieldDetail" component={TextFieldDetailScreen} options={{ title: 'TextField' }} />
        <Stack.Screen name="FieldErrorDetail" component={FieldErrorDetailScreen} options={{ title: 'FieldError' }} />
        <Stack.Screen name="AppShellDetail" component={AppShellDetailScreen} options={{ title: 'App-shell' }} />
        <Stack.Screen name="HeroDetail" component={HeroDetailScreen} options={{ title: 'Hero' }} />
        <Stack.Screen name="LoaderDetail" component={LoaderDetailScreen} options={{ title: 'Loader' }} />
        <Stack.Screen name="ErrorAlertDetail" component={ErrorAlertDetailScreen} options={{ title: 'ErrorAlert' }} />
        <Stack.Screen name="PageStatusDetail" component={PageStatusDetailScreen} options={{ title: 'PageStatus' }} />
        <Stack.Screen name="ListContainerDetail" component={ListContainerDetailScreen} options={{ title: 'ListContainer' }} />
        <Stack.Screen name="NavigationRowDetail" component={NavigationRowDetailScreen} options={{ title: 'NavigationRow' }} />
        <Stack.Screen name="SearchFieldDetail" component={SearchFieldDetailScreen} options={{ title: 'SearchField' }} />
        <Stack.Screen name="SelectionRowDetail" component={SelectionRowDetailScreen} options={{ title: 'SelectionRow' }} />
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

function CardDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <DetailHeader name="Card" description="Overflate som grupperer relatert innhold." usage="Bruk når en avgrenset oppsummering eller gruppe trenger felles flate og kant." />
      <Card testID="catalog-card">
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Overskrift</Text>
        <Text style={[typography.body, { color: colors.text }]}>Avgrenset innhold på en felles flate.</Text>
      </Card>
    </ScrollView>
  );
}

function DataRowDetailScreen() {
  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <DetailHeader name="DataRow" description="Statisk etikett og verdi i en dataliste." usage="Bruk når lesbart, ikke-redigerbart data skal oppsummeres i en gruppe." />
      <Card>
        <DataRow label="Etikett" value="Verdi" showSeparator testID="catalog-datarow" />
        <DataRow label="Neste etikett" value="Neste verdi" showSeparator />
      </Card>
    </ScrollView>
  );
}

function DialogDetailScreen() {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(true);
  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <DetailHeader name="Dialog" description="Modal beholder for bekreftelse og destruktive handlinger." usage="Bruk når brukeren må ta stilling før den underliggende skjermen kan brukes videre." />
      <Button title="Vis dialog" variant="secondary" onPress={() => setVisible(true)} />
      <Dialog visible={visible} title="Slett element?" onRequestClose={() => setVisible(false)}>
        <Text style={[typography.body, { color: colors.text }]}>Denne handlingen kan ikke angres.</Text>
        <Button title="Avbryt" variant="secondary" onPress={() => setVisible(false)} />
        <Button title="Slett" variant="destructive" onPress={() => setVisible(false)} />
      </Dialog>
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

function HeroDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-hero">
      <DetailHeader
        name="Hero"
        description="Romslig startside med én tydelig hovedoppgave og få alternativer."
        usage="Bruk når skjermen er et startpunkt med én dominerende handling og få sekundære valg."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Komposisjon</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Generisk eksempel med nøytral tittel, beskrivelse og primær/sekundære handlinger. Domeneinnhold vises bare i eksempler.
        </Text>
        <Hero title="Klar for en økt?" description="Registrer øvelser og sett mens du trener." testID="catalog-hero-example">
          <Button title="Start økt" variant="primary" onPress={() => {}} testID="catalog-hero-primary" />
          <Button title="Tidligere økter" variant="secondary" onPress={() => {}} testID="catalog-hero-secondary-1" />
          <Button title="Øvelser" variant="secondary" onPress={() => {}} testID="catalog-hero-secondary-2" />
          <Button title="Innstillinger" variant="secondary" onPress={() => {}} testID="catalog-hero-secondary-3" />
        </Hero>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Opptatt tilstand</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>
          Primær handling viser opptatt spinner og deaktiverer sekundære valg mens en operasjon pågår.
        </Text>
        <Hero title="Klar for en økt?" description="Registrer øvelser og sett mens du trener." testID="catalog-hero-busy">
          <Button title="Starter økt" variant="primary" busy onPress={() => {}} testID="catalog-hero-busy-primary" />
          <Button title="Tidligere økter" variant="secondary" disabled onPress={() => {}} testID="catalog-hero-busy-secondary" />
        </Hero>
      </View>
    </ScrollView>
  );
}

function LoaderDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-loader">
      <DetailHeader
        name="Loader"
        description="Aktivitetsindikator i stor sidevariant og kompakt inline-variant, begge med valgfri statusetikett."
        usage="Bruk stor loader når hovedinnholdet på en hel skjerm venter. Bruk kompakt loader i en knapp, rad eller lokal operasjon."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Størrelser</Text>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Stor · sideinnhold</Text>
          <Loader label="Laster øvelser" size="large" testID="catalog-loader-large" />
        </View>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Kompakt · inline</Text>
          <Loader label="Lagrer" size="compact" testID="catalog-loader-compact" />
        </View>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Uten etikett</Text>
          <Loader size="large" testID="catalog-loader-no-label" />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>I kontekst</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>Kompakt loader vises i handlingsområdet der en primær handling ellers står.</Text>
        <View style={[styles.controlGroup, { alignItems: 'center' }]}>
          <Loader label="Laster aktiv økt" size="compact" testID="catalog-loader-home" />
        </View>
      </View>
    </ScrollView>
  );
}

function ErrorAlertDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-erroralert">
      <DetailHeader
        name="ErrorAlert"
        description="Lokal feilmelding med fareikon, svak fareflate og valgfri gjenopprettingshandling."
        usage="Bruk når en avgrenset operasjon feiler, mens resten av skjermen fortsatt er gyldig og nyttig."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Varianter</Text>
        <Text style={[typography.metadata, { color: colors.muted }]}>Farge eller ikon er aldri eneste signal — teksten bærer betydningen.</Text>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Melding alene</Text>
          <ErrorAlert message="Kunne ikke laste inn" testID="catalog-erroralert-message" />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Med tittel</Text>
          <ErrorAlert title="Kunne ikke lagre" message="Kontroller tilkoblingen og prøv igjen." testID="catalog-erroralert-titled" />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Med sekundær handling</Text>
          <ErrorAlert
            message="Endringene er ikke lagret"
            actionTitle="Prøv igjen"
            onAction={() => {}}
            actionTestID="catalog-erroralert-action"
            testID="catalog-erroralert-with-action"
          />
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Ulagret varsel</Text>
          <ErrorAlert message="Økten har endringer som ikke er lagret" testID="catalog-erroralert-unsaved" />
        </View>
      </View>
    </ScrollView>
  );
}

function PageStatusDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-pagestatus">
      <DetailHeader
        name="PageStatus"
        description="Sentrert sideoppsett for lasting, tomt innhold, feil og sikkerhetsstopp."
        usage="Bruk når skjermens hovedinnhold ikke kan vises. Velg variant etter om brukeren venter, kan prøve igjen eller må stoppe."
      />

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Varianter</Text>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Laster</Text>
          <View style={[styles.errorPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <PageStatus variant="loading" loaderLabel="Starter Trene" testID="catalog-pagestatus-loading" />
          </View>
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Feil · med primær retry</Text>
          <View style={[styles.errorPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <PageStatus
              variant="error"
              title="Trene kunne ikke starte"
              message="Dataene dine er ikke endret. Prøv å starte på nytt."
              actionTitle="Prøv igjen"
              onAction={() => {}}
              actionTestID="catalog-pagestatus-retry"
              testID="catalog-pagestatus-error"
            />
          </View>
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Gjentatt feil</Text>
          <View style={[styles.errorPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <PageStatus
              variant="error"
              title="Trene kunne ikke starte"
              message="Dataene dine er ikke endret. Prøv å starte på nytt."
              secondaryMessage="Hvis problemet fortsetter, avslutt appen helt og åpne den igjen."
              actionTitle="Prøv igjen"
              onAction={() => {}}
              testID="catalog-pagestatus-repeated"
            />
          </View>
        </View>

        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Låst sikkerhetsstopp · uten handling</Text>
          <View style={[styles.errorPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <PageStatus
              variant="safe-stop"
              title="Trene kan ikke åpne dataene trygt"
              message="Gjenopprettingen ble avbrutt, og ingen av databasene kunne bekreftes. Dataene er bevart for hjelp med gjenoppretting."
              secondaryMessage="Ikke slett eller installer appen på nytt."
              testID="catalog-pagestatus-safestop"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ListContainerDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-listcontainer">
      <DetailHeader
        name="ListContainer"
        description="Grupperer relaterte rader med felles kant, avrunding, klipping og skillelinjer."
        usage="Bruk når flere relaterte rader skal oppleves som én samling."
      />
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Komposisjon</Text>
        <ListContainer testID="catalog-listcontainer">
          <NavigationRow title="Første rad" description="Valgfri forklaring" showSeparator onPress={() => {}} />
          <NavigationRow title="Andre rad" onPress={() => {}} />
        </ListContainer>
      </View>
    </ScrollView>
  );
}

function NavigationRowDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-navigationrow">
      <DetailHeader
        name="NavigationRow"
        description="Trykkbar rad med tittel, valgfri beskrivelse og pil."
        usage="Bruk når hele raden åpner en ny skjerm."
      />
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Varianter</Text>
        <ListContainer>
          <NavigationRow title="Med beskrivelse" description="Forklarer valget" showSeparator onPress={() => {}} testID="catalog-navigationrow-description" />
          <NavigationRow title="Med metadata" metadata="12 elementer" showSeparator onPress={() => {}} testID="catalog-navigationrow-metadata" />
          <NavigationRow title="Uten beskrivelse" onPress={() => {}} testID="catalog-navigationrow-title" />
        </ListContainer>
      </View>
    </ScrollView>
  );
}

function SearchFieldDetailScreen() {
  const { colors } = useAppTheme();
  const [value, setValue] = useState('');
  const focusRef = useRef<TextInput>(null);
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-searchfield">
      <DetailHeader
        name="SearchField"
        description="Filtrerer en liste fortløpende med fokusmarkering og søketastatur."
        usage="Bruk når en liste kan bli lang nok til at visuell skanning ikke er effektiv."
      />
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Tilstander</Text>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Tom</Text>
          <SearchField label="Søk i liste" value={value} onChangeText={setValue} testID="catalog-searchfield-empty" />
        </View>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Med søk</Text>
          <SearchField label="Søk i liste" value="eksempel" onChangeText={() => {}} testID="catalog-searchfield-value" />
        </View>
        <View style={styles.controlGroup}>
          <Text style={[typography.metadata, styles.variantLabel, { color: colors.muted }]}>Fokus (trykk for å se)</Text>
          <SearchField autoFocus label="Søk i liste" value="" onChangeText={() => {}} testID="catalog-searchfield-focus" />
        </View>
      </View>
    </ScrollView>
  );
}

function SelectionRowDetailScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView contentContainerStyle={styles.detail} testID="catalog-detail-selectionrow">
      <DetailHeader
        name="SelectionRow"
        description="Trykkbar rad for å velge ett element, med valgfri fremdrift i etterfølgende plass. Tittelen beholdes også mens raden er opptatt."
        usage="Bruk når brukeren skal velge ett eksisterende element fra en liste uten å navigere videre. Bruk opptatt tilstand mens valget lagres."
      />
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.metadata, { color: colors.muted, fontWeight: '700' }]}>Tilstander</Text>
        <ListContainer>
          <SelectionRow title="Normal" showSeparator onPress={() => {}} testID="catalog-selectionrow-normal" />
          <SelectionRow title="Deaktivert" disabled showSeparator onPress={() => {}} testID="catalog-selectionrow-disabled" />
          <SelectionRow title="Opptatt" busy onPress={() => {}} testID="catalog-selectionrow-busy" />
        </ListContainer>
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
