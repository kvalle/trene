# Trene designsystem

Status: førsteutkast, 22. august 2026.

## Formål

Dette dokumentet og den tilhørende komponentkatalogen er førsteutkastet til
Trenes designsystem. Det er den normative visuelle referansen for nye
grensesnittsendringer. Katalogen viser ønsket retning; eksisterende appkode kan
fortsatt avvike frem til komponentene er implementert og tatt i bruk.

## Designretning

Trenes visuelle retning kjennetegnes av:

- rolige, luftige flater og tydelig visuelt hierarki
- moderat avrunding: `12` for kort og grupper, `9` for felt og knapper
- systemtypografi og dagens skjermstruktur, innhold og arbeidsflyt
- tydelige primære, sekundære og destruktive handlinger
- full støtte for lys og mørk modus

## Prinsipper

- Bruk få, generelle komponenter med dokumenterte varianter fremfor
  skjermspesifikke komponenter.
- Navngi komponenter etter UI-rollen, ikke treningsdomenet. Domenedata hører
  hjemme i eksempler og komposisjoner.
- Bruk én tydelig primærhandling per kontekst. Sekundære og tekstlige handlinger
  skal ikke konkurrere med den.
- Bruk farge, ikon og tekst sammen for viktige tilstander. Ingen betydning skal
  formidles bare med farge, bevegelse eller haptikk.
- Bevar leserekkefølge, fokusflyt, tilgjengelighetsnavn, tilstander og minst
  `44 x 44` punkters trykkflate på iOS og `48 x 48` dp på Android.
- Alle komponenter skal fungere med lyst og mørkt systemtema, stor tekst og
  redusert bevegelse.

## Fargetokens

| Token | Lys | Mørk | Bruk |
| --- | --- | --- | --- |
| `background` | `#f5f7f2` | `#111713` | Skjermbakgrunn |
| `surface` | `#ffffff` | `#1a241e` | Kort, dialoger og grupper |
| `surfaceAlt` | `#e8f0e6` | `#24382c` | Informasjon og rolige støtteflater |
| `text` | `#17261e` | `#edf4ef` | Primær tekst |
| `muted` | `#617168` | `#a6b7ad` | Sekundær tekst |
| `primary` | `#246b4d` | `#80c9a2` | Primære handlinger og fokus |
| `onPrimary` | `#ffffff` | `#102019` | Innhold på primærfargen |
| `secondary` | `#d8e8dc` | `#294535` | Markering og andre grønntonede støtteflater |
| `onSecondary` | `#214b35` | `#d9f2e2` | Innhold på sekundærfargen |
| `border` | `#bdcbbf` | `#405247` | Kanter og skillelinjer |
| `danger` | `#a43f36` | `#ffb4aa` | Destruktive handlinger og feil |
| `onDanger` | `#ffffff` | `#2b0b08` | Innhold på farefargen |
| `focus` | `#8abfa4` | `#80c9a2` | Fokusmarkering |

`background` er appens lerret. `surface` løfter interaktive eller grupperte
elementer fra lerretet. `surfaceAlt` brukes sparsomt for informasjon og rolig
utheving. `secondary` er ikke lenger en knappflate; sekundærknapper bruker
`surface`, nøytral `border` og vanlig `text`.

Bakgrunnen rundt enhetsvisningen i komponentkatalogen bruker `#e8ede7` i lys
modus og `#0b110d` i mørk modus. Dette er presentasjon av katalogen, ikke en
app-token.

## Form og typografi

- Radius for kort, dialoger og grupper: `12`.
- Radius for felt og knapper: `9`.
- Bruk systemtypografi inntil en annen font er eksplisitt valgt og testet.
- Bruk få semantiske nivåer: skjermtittel, seksjonstittel, vanlig tekst,
  metadata/hjelpetekst og kontrolltekst.
- Ikke lag nye fontstørrelser eller vekter lokalt dersom et eksisterende nivå
  dekker behovet.
- Sekundær tekst bruker `muted`; den skal fortsatt møte kontrastkravene.

## Implementeringsstatus

Katalogen beskriver ønsket bibliotek, men komponentene er ennå ikke samlet i en
ferdig kodepakke. Ved implementering skal gjentatt styling flyttes til delte
komponenter uten å endre dagens tilgjengelighetsatferd eller skjermflyter.

## Komponentkatalog

Runtime-katalogen dokumenterer komponentmønstrene og viser hvert mønster på en
representativ skjerm. Katalogen dekker navigasjon og struktur,
handlinger, skjema, lister og beholdere, feedback, sidevisninger og dialoger.
Den inkluderer relevante normal-, tom-, laste-, feil-, deaktivert-, opptatt- og
destruktive tilstander.

«Prøv igjen» er ikke en egen knappetype. Det er en primærknapp brukt som
gjenopprettingshandling i en feiltilstand. Knapphierarkiet består av primær,
sekundær, tekst og destruktiv. Primærknappen er fylt grønn, mens sekundærknappen
har overflatefarge og nøytral kant. Deaktivert og opptatt er tilstander på
interaktive komponenter, ikke egne komponenter. Deaktiverte handlinger bruker
nøytral fyll, kant og tekst uten vanlig handlingssignal, slik at tilstanden ikke
leses som et ekstra nivå i handlingshierarkiet.

Små handlinger i rader er kompakte tekstknapper, ikke et eget hierarkinivå. De
bruker et relevant ikon sammen med en synlig tekstetikett; ikonet skal
tydeliggjøre handlingen, men teksten skal fortsatt bære betydningen.

Hver komponent i katalogen har en egen «Bruk når»-veiledning. Denne beskriver
komponentens semantiske rolle og skal brukes ved valg mellom visuelt lignende
komponenter. Veiledningen er også inkludert i katalogsøket.

Komponentene navngis etter generelle UI-mønstre, ikke etter treningsdomenet.
Domeneinnhold som øvelser og sett brukes bare i eksemplene. Lister bygges av en
listebeholder og en generell rad. Beholderen eier ytterkant, avrunding, klipping
og skillelinjer. Raden eier layout, trykkflate og tilstand, med varianter for
navigasjon, valg og statiske data. Radens ledende innhold, tekstblokk og
etterfølgende innhold er plasser i raden, ikke egne komponenter. Metadata, lokal
handling og opptatt tilstand er varianter. Oppsummeringer er komposisjoner av
kort og datarader. Utvidbare kort dokumenteres i både kollapset og åpen tilstand.

Feedback og sidevisninger holdes adskilt. Loader, informasjonsvarsel og
feilvarsel er komponenter som kan plasseres i ulike kontekster. Lasting, tomt
innhold, ingen søkeresultater, feil og manglende ressurs er innholdsvarianter av
den sammensatte komponenten «Sidestatus». Sidestatus eier sentrering og vertikal
struktur, mens innholdet avgjør om den bruker loader, tekst og/eller handling.

Loaderen har to størrelsesvarianter: stor for blokkert hovedinnhold i en
sidestatus, og kompakt for knapper, rader og lokale operasjoner. Et feilvarsel
bruker fareikon, svak fareflate og farekant i tillegg til tekst; farge eller ikon
skal ikke være eneste signal om feil.

Dialog er grunnkomponenten, med bekreftende og destruktiv variant.
Forhåndsvisning av gjenoppretting er et flertrinns brukseksempel, ikke en egen
komponent. Låst sikkerhetsstopp er et ikke-avvisbart feileksempel komponert av
dialog og feilinnhold, heller ikke en egen komponent.

En sikkerhetsstopp som oppstår før appens navigasjon er tilgjengelig, vises som
en ikke-avvisbar helsides feilvariant av `Sidestatus`. En sikkerhetsstopp som
oppstår i en pågående modal arbeidsflyt, som gjenoppretting, beholder konteksten
og vises som en ikke-avvisbar dialog.

### Runtime-katalogen (React Native, Expo Go)

Runtime-katalogen er en separat Expo-utviklingsapp som importerer produksjonstemaet (`src/theme`), app-shell-kontrakten (`src/ui/appShell`, `src/ui/AppThemeProvider`) og UI-komponenter gjennom samme offentlige modulgrenser som `src/App.tsx`. Ingen farger, typer eller navigatoroppsett dupliseres.

Katalogen kjører i Expo Go og krever ingen ny native bygg av Trene. Den deler ikke bundle-identifier med `com.kjetilvalle.trene` og kan derfor ligge installert side om side med Trene på samme enhet.

Start direkte på plattform:

```sh
npm run catalog:android  # starter Metro med katalog-entrypoint og åpner i Expo Go på Android-emulator/enhet
npm run catalog:ios      # starter Metro med katalog-entrypoint og åpner i Expo Go på iOS-simulator
npm run catalog          # generisk Expo start (velg selv plattform i Expo CLI, W for web, a/i for device)
```

Katalog-entrypoint velges via `EXPO_PUBLIC_COMPONENT_CATALOG=1` (`src/entrypoint.ts` → `index.ts`). Uten variabelen starter `index.ts` produksjonsappen `src/App`. Produksjonsentrypointet er uendret.

Katalogen er strukturert som oversikt → detalj via native stack, gruppert som i kapittelet over
(Handlinger, Skjema, Navigasjon og struktur — kun grupper med implementerte komponenter vises). Hver
detaljskjerm viser navn/beskrivelse/«Bruk når» og alle varianter/tilstander med generiske, isolerte
eksempler.

Katalogen demonstrerer:

- lys/mørk modus via bryteren «Mørk modus» på oversikten (`AppThemeProvider` scheme-toggle)
- native stack og modal via samme `getAppStackScreenOptions` som produksjonen (vist under Navigasjon og struktur)
- systemtekstskalering (`PixelRatio.getFontScale()`) – synlig på oversikten og i app-shell-detaljen

Forutsetninger:

- Node >= 22.13 og `npm install`
- Expo Go: installeres automatisk av `expo start --android/--ios` når enheten/simulatoren mangler den (praktisk på emulator/simulator; fysisk enhet krever normalt manuell installasjon)
- Android: kjørende emulator eller enhet synlig i `adb devices`; ADB reverse kobler port 8081 automatisk
- iOS: Xcode med tilgjengelig simulator (`xcrun simctl`); simulatoren booter automatisk om nødvendig
- Port 8081 må være ledig; Metro lytter på `127.0.0.1`

Metro-eierskap og avslutning:

- `npm run catalog:android` / `npm run catalog:ios` eier Metro-prosessen i terminalen som startet kommandoen (`scripts/run-catalog.sh` setter `__UNSAFE_EXPO_HOME_DIRECTORY=.artifacts/expo` og `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` og exec-er `expo start`).
- Avslutt med `Ctrl+C` i samme terminal. Expo Go forblir installert, men mister tilkoblingen. Å starte en annen kataloginstans gjenbruker samme Metro-adresse.
- `npm run start:android` eier en separat Metro for Trene-native; katalogens Metro kolliderer ikke med Trene-APK-en, men to Metro-instanser kan ikke dele 8081 samtidig.

Den midlertidige HTML-referansen er fjernet. Alle godkjente mønstre er nå
representert med produksjonskomponenter i React Native-katalogen.

## Arbeidsregel for agenter

Før en agent implementerer eller gjennomgår en brukergrensesnittsendring, skal
agenten lese dette dokumentet og kontrollere endringen mot komponentkatalogen.
Eksisterende komponenter og varianter skal gjenbrukes.

Hvis behovet ikke dekkes, eller løsningen krever en ny komponent, ny variant,
ny token eller avvik fra designsystemet, skal agenten stoppe og avklare valget
med brukeren før implementering. Agenten skal ikke innføre slike avvik stilltiende
eller bare fordi eksisterende appkode allerede avviker.

Ved visuell verifikasjon skal agenten minst kontrollere relevant normaltilstand,
lys og mørk modus, samt berørte tomme, opptatte, deaktiverte og feiltilstander.
