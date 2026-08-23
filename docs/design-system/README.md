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

`docs/design-system/catalog/` dokumenterer komponentmønstrene og viser hvert
mønster på en representativ skjerm. Katalogen dekker navigasjon og struktur,
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

Start React Native-katalogen med `npm run catalog` og åpne den i Expo på samme
måte som appen. Katalogen importerer produksjonstemaet og app-shell-kontrakten,
og viser lyst og mørkt tema, stor tekst, native stack og native modal.

Den midlertidige HTML-referansen startes fortsatt med
`npm run prototype:components` og åpnes på `http://localhost:4174`. Hvert
komponentvalg kan lenkes direkte med `?component=<id>`. Den fjernes først når
alle godkjente mønstre er representert med produksjonskomponenter i
React Native-katalogen.

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
