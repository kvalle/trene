# Migreringsgrunnlag for designsystemet

Dette dokumentet kartlegger grunnlaget for å dele migreringen av appen til
designsystemet i overkommelige tickets. Det beskriver ikke nye komponentvedtak.
Uavklarte varianter må vurderes før de inngår i en implementasjonsticket.

## Komponentmatrise

Matrisen dekker alle registrerte skjermer og oppstartsflaten. `PlaceholderScreen`
er ikke registrert i navigasjonen og inngår derfor ikke i migreringen.

| Skjerm | Struktur | Handlinger | Skjema | Innhold | Feedback og tilstander | Dialoger |
| --- | --- | --- | --- | --- | --- | --- |
| Oppstart | Sidestatus | Primær | – | – | Stor loader, feil, låst sikkerhetsstopp | – |
| Forside | Hero-layout | Primær, sekundær, opptatt, deaktivert | – | – | Kompakt loader, feilvarsel | – |
| Treningsøkt | Stakk-header | Primær, sekundær, tekst, destruktiv, liten, opptatt, deaktivert | Tallfelt, feltfeil, skjemadel | Utvidbart kort, datarad | Sidestatus for lasting/feil/tomt innhold, lokale feilvarsler | Bekreftende og destruktiv |
| Fullført økt | Stakk-header | Primær, destruktiv, opptatt, deaktivert | – | Kort, datarad | Sidestatus for lasting/feil/manglende ressurs, feilvarsel | Destruktiv |
| Historikk | Stakk-header | Primær, opptatt | – | Listebeholder, navigasjonsrad | Sidestatus for lasting/feil/tomt innhold, feilvarsel | – |
| Øvelser | Stakk-header | Primær, sekundær | Søkefelt | Listebeholder, navigasjonsrad | Sidestatus for lasting/feil/tomt innhold/ingen treff | – |
| Innstillinger | Stakk-header | – | – | Listebeholder, navigasjonsrad | – | – |
| Data | Stakk-header, seksjonert innhold | Primær, sekundær, destruktiv, opptatt, deaktivert | – | Informasjonsvarsel, datarader i forhåndsvisning | Kompakt loader, feilvarsel | Grunndialog, destruktiv og låst sikkerhetsstopp |
| Øvelsesdetalj | Stakk-header, seksjonert detaljside | Primær, destruktiv, opptatt, deaktivert | Tekstfelt, feltfeil | Kort, datarad | Sidestatus for lasting/feil/manglende ressurs, lokalt tomt innhold, feilvarsel | Destruktiv |
| Øvelsesvelger | Modal skjerm | Primær, tekst, opptatt, deaktivert | Søkefelt | Listebeholder, valgrad | Sidestatus for lasting/feil/tomt innhold/ingen treff, kompakt loader, feilvarsel | – |
| Ny øvelse | Modal skjerm | Primær, tekst, opptatt, deaktivert | Tekstfelt, feltfeil | – | – | – |

## Detaljer per skjerm

### Oppstart

Kilde: `src/StartupGate.tsx`

- Lasting bruker `Sidestatus` med stor loader.
- Gjenopprettbar oppstartsfeil bruker feilvariant med primær
  gjenopprettingshandling.
- Gjentatt feil er samme variant med mer forklaring.
- Låst sikkerhetsstopp er en ikke-avvisbar helsides feilvariant av `Sidestatus`
  uten handlinger, siden navigasjonen ennå ikke er tilgjengelig.

### Forside

Kilde: `src/screens/HomeScreen.tsx`

- Skjermen bruker hero-layout med én primær start-/fortsett-handling.
- Historikk, øvelser og innstillinger er sekundære handlinger.
- Oppstart av økt bruker opptatt primærknapp og deaktiverte støttehandlinger.
- Oppslag av aktiv økt bruker kompakt loader i handlingsområdet.
- Feil ved oppslag eller oppstart og varsel om ulagrede endringer bruker
  `Feilvarsel`.

### Treningsøkt

Kilde: `src/screens/WorkoutScreen.tsx`

- Hver øvelse bruker `Utvidbart kort` i kollapset eller åpen tilstand.
- Bekreftede sett bruker datarader med valgfri liten redigeringshandling.
- Planlagte sett bruker skjemadel, tallfelt og feltfeil.
- Bekreft, legg til sett og ferdig er primære handlinger i hver sin kontekst.
- Slett planlagt sett og legg til øvelse er sekundære handlinger.
- Fjern øvelse er destruktiv; avbryt økten er teksthandling på siden.
- Operasjonsfeil bruker lokale feilvarsler med eventuell
  gjenopprettingshandling.
- Lasting og total innlastingsfeil bruker sidestatus. Tom økt bruker en lokal
  tomtilstand fordi resten av arbeidsflaten fortsatt er tilgjengelig.
- Fjerning og avbryting bruker destruktive dialoger. Fullføring bruker
  bekreftelsesdialog.

### Fullført økt

Kilde: `src/screens/CompletedWorkoutScreen.tsx`

- Oppsummeringen bygges av kort med datarader.
- Lasting, total feil og manglende økt bruker sidestatus.
- Sletting bruker destruktiv knapp og destruktiv dialog.
- Feil ved sletting bruker lokalt feilvarsel med gjenopprettingshandling.
- Tilbake til forsiden er primær handling når skjermen åpnes etter fullføring.

### Historikk

Kilde: `src/screens/HistoryScreen.tsx`

- Fullførte økter bruker én listebeholder med navigasjonsrader.
- Lasting, total feil og tom historikk bruker sidestatus.
- Start eller fortsett økt fra tomtilstanden bruker primær/opptatt knapp.
- Feil ved oppstart bruker lokalt feilvarsel.

### Øvelser

Kilde: `src/screens/ExercisesScreen.tsx`

- Øvelser bruker én listebeholder med navigasjonsrader og metadata.
- Listen filtreres med søkefelt.
- Lasting, total feil, tom katalog og ingen treff bruker sidestatus.
- Oppretting er primær handling i tomtilstander og sekundær under en liste.

### Innstillinger

Kilde: `src/screens/SettingsScreen.tsx`

- Data åpnes fra en navigasjonsrad i en listebeholder.
- Flere innstillinger kommer snart. Skjermen planlegges derfor direkte som en
  liste selv om den bare har én rad under den første migreringen.

### Data

Kilde: `src/screens/DataScreen.tsx`

- Personvernforklaringen bruker informasjonsvarsel.
- Opprett sikkerhetskopi er primær handling; gjenopprett er sekundær.
- Pågående operasjoner bruker kompakt loader i opptatt knapp og deaktiverer
  konkurrerende handlinger.
- Gjenopprettbare feil bruker lokalt feilvarsel.
- Forhåndsvisning bruker grunndialog med datarader og primær fortsett-handling.
- Endelig erstatning bruker destruktiv dialog.
- Låst sikkerhetsstopp komponeres av ikke-avvisbar dialog og feilinnhold uten
  handlinger, fordi feilen oppstår i en pågående modal arbeidsflyt.

### Øvelsesdetalj

Kilde: `src/screens/ExerciseDetailScreen.tsx`

- Siden bruker seksjonert detaljlayout.
- Navn bruker tekstfelt med normal, feil, deaktivert og opptatt lagringstilstand.
- Historikk bygges av kort med datarader. Manglende historikk er lokal
  tomtekst, ikke en helsides sidestatus.
- Lasting, total feil og manglende øvelse bruker sidestatus.
- Sletting bruker destruktiv knapp og destruktiv dialog.
- Feil ved sletting bruker lokalt feilvarsel.

### Øvelsesvelger

Kilde: `src/screens/ExercisePickerScreen.tsx`

- Skjermen er en modal arbeidsflyt med søkefelt.
- Valgene bruker listebeholder og valgrader.
- Valgt rad viser kompakt loader; øvrige rader og handlinger deaktiveres.
- Lasting, total feil, tom katalog, alle allerede valgte og ingen treff bruker
  sidestatus med tilpasset innhold.
- Opprett øvelse er primær handling; avbryt er teksthandling.
- Feil ved valg bruker lokalt feilvarsel.

### Ny øvelse

Kilde: `src/screens/CreateExerciseScreen.tsx`

- Skjermen er en modal arbeidsflyt med tekstfelt og feltfeil.
- Opprett er primær/opptatt handling; avbryt er teksthandling.
- Feltet og avbryt-handlingen deaktiveres under lagring.

## Deling på tvers av skjermer

| Komponentfamilie | Brukes av |
| --- | --- |
| Tema, typografi og stakk-header | Alle ruteskjermer |
| Primærknapp | Alle skjermer unntatt Innstillinger |
| Sekundær- og tekstknapp | Forside, Treningsøkt, Data, Øvelsesvelger, Ny øvelse og dialoger |
| Destruktiv knapp | Treningsøkt, Fullført økt, Data og Øvelsesdetalj |
| Opptatte/deaktiverte handlinger | Forside, Treningsøkt, Fullført økt, Historikk, Data, Øvelsesdetalj, Øvelsesvelger og Ny øvelse |
| Tekstfelt og feltfeil | Ny øvelse og Øvelsesdetalj |
| Søkefelt | Øvelser og Øvelsesvelger |
| Listebeholder og navigasjonsrad | Historikk, Øvelser og Innstillinger |
| Valgrad | Øvelsesvelger |
| Kort og datarad | Treningsøkt, Fullført økt, Data og Øvelsesdetalj |
| Sidestatus og loader | Oppstart og alle asynkrone dataskjermer |
| Feilvarsel | Oppstart og alle skjermer med lokale operasjoner |
| Dialog | Treningsøkt, Fullført økt, Data og Øvelsesdetalj |

## Udekkede tilstander

Følgende behov passer komponentmodellen, men må vises tydeligere i katalogen:

- deaktivert søkefelt, tekstfelt og tallfelt
- deaktivert tekstknapp
- opptatt/deaktivert sekundær, destruktiv og liten handling
- ikke-avvisbar helsides feiltilstand for oppstart

Dette er tilstandsvarianter av eksisterende komponenter. Deaktivert og opptatt
skal modelleres som tilstander på alle relevante interaktive komponenter, ikke
som egne komponenter. Kartleggingen avdekker ikke noe klart behov for en ny
grunnkomponent.

## Migreringsrekkefølge

Migreringen bør deles i tolv tracer-bullet-tickets. Hver ticket introduserer
bare komponentene som den aktuelle skjermen trenger. Slik formes delte API-er av
reelle brukstilfeller i stedet for å bli ferdigdesignet på forhånd.

| Nr. | Leveranse | Etablerer eller utvider | Avhenger av |
| --- | --- | --- | --- |
| 1 | Tema, app-shell og runtime-katalog | Tokens, tematilgang, navigasjonsheader og katalog for faktiske React Native-komponenter | – |
| 2 | Kontroller og Ny øvelse | Knappgrunnlag, primær-/tekstvariant, opptatt/deaktivert tilstand, tekstfelt og feltfeil | 1 |
| 3 | Feedback, Forside og Oppstart | Sekundærknapp, loader, feilvarsel, sidestatus og hero-layout | 2 |
| 4 | Navigasjonslister, Innstillinger og Historikk | Listebeholder, rad og navigasjonsrad | 3 |
| 5 | Søkbar liste og Øvelser | Søkefelt og navigasjonsrad med metadata | 4 |
| 6 | Valgflyt og Øvelsesvelger | Valgrad med opptatt/deaktivert tilstand og modal komposisjon | 5 |
| 7 | Kort, destruktiv dialog og Fullført økt | Kort, datarad, dialoggrunnlag og destruktive handlinger | 3 |
| 8 | Øvelsesdetalj | Seksjonert detaljlayout og gjenbruk av felt, kort, datarad og dialog | 2, 3 og 7 |
| 9 | Designprototype for Data | Godkjent gjenopprettingsflyt og sikkerhetstilstander, ingen produksjonskomponenter | – |
| 10 | Data og sikkerhetskritiske tilstander | Informasjonsvarsel, dialogforhåndsvisning og låst dialog | 3, 7 og 9 |
| 11 | Designprototype for Treningsøkt | Godkjent komposisjon og tilstander, ingen produksjonskomponenter | – |
| 12 | Implementer Treningsøkt og fullfør komponentbiblioteket | Utvidbart kort, skjemadel, tallfelt og liten handling; erstatt den midlertidige HTML-katalogen | 6, 8, 10 og 11 |

Avhengighetsgraf:

```text
1 Tema, app-shell og runtime-katalog
└── 2 Kontroller og Ny øvelse
    └── 3 Feedback, Forside og Oppstart
        ├── 4 Navigasjonslister, Innstillinger og Historikk
        │   └── 5 Søkbar liste og Øvelser
        │       └── 6 Valgflyt og Øvelsesvelger
        └── 7 Kort, dialog og Fullført økt
            ├── 8 Øvelsesdetalj
            └── 10 Data

9 Designprototype for Data ──────────────────────────────── 10 Data

11 Designprototype for Treningsøkt ─────────────────────┐
6, 8 og 10 ferdige før endelig integrasjon ─────────────┼── 12 Treningsøkt
```

## Parallellisering

- Ticket 9 og 11 kan starte parallelt med alle andre tickets fordi de bare
  endrer prototyper og dokumentasjon.
- Ticket 4 og 7 kan gjennomføres parallelt etter ticket 3. De eier henholdsvis
  liste- og kort/dialogfamilien.
- Ticket 5, 8 og 10 kan deretter gjennomføres parallelt, men ticket 8 og 10 skal
  behandle API-et fra ticket 7 som stabilt.
- Ticket 6 følger ticket 5 fordi den utvider både søkefeltet og radmodellen med
  deaktiverte og opptatte tilstander.
- Ticket 12 gjennomføres sist. Den bruker nesten alle komponentfamiliene og skal
  ikke bli stedet hvor grunnleggende API-er utformes på nytt.

## Avgrensning per ticket

- Ticket 1 skal ikke bygge spekulative skjerm- eller komponentabstraksjoner. Den
  etablerer tokens, tematilgang, app-shell og en minimal runtime-katalog som
  senere tickets fyller med faktiske produksjonskomponenter.
- Ticket 2 bruker Ny øvelse som første reelle forbruker av kontrollene.
  Sekundær, destruktiv, søk, tallfelt og små handlinger kommer først når en
  konkret senere skjerm trenger dem.
- Ticket 3 samler Forside og Oppstart fordi de sammen validerer både lokal og
  helsides feedback.
- Ticket 4 flytter Innstillinger hit fra kontrollticketen. Historikk validerer
  at samme radmodell fungerer for flere elementer og sidestatuser.
- Ticket 5 og 6 holdes adskilt. Først etableres søk og filtrering uten
  sideeffekter, deretter valg, opptatt tilstand og modal navigasjon.
- Ticket 7 bruker Fullført økt som den enkleste reelle forbrukeren av kort,
  datarader og destruktiv dialog.
- Ticket 8 gjenbruker etablerte komponenter på en mer sammensatt detaljside og
  skal ikke lage et domenespesifikt historikkort.
- Ticket 9 avklarer den sikkerhetskritiske gjenopprettingsflyten før ticket 10
  implementerer den med eksisterende komponenter.
- Ticket 11 må avklare hele Treningsøkt før ticket 12 starter. Domenelogikk og
  operasjonstilstand skal bli i skjermen, ikke flyttes inn i generelle
  designkomponenter.

## Konfliktflater

- `src/theme.ts` og `src/AppNavigator.tsx` eies i hovedsak av ticket 1.
- Delte knapp- og feltfiler etableres i ticket 2 og utvides kontrollert senere.
- Rad-API-et eies av ticket 4–6; disse ticketene kjøres i rekkefølge.
- Dialog-API-et eies først av ticket 7. Ticket 10 eier sikkerhetsutvidelsene.
- Den midlertidige HTML-katalogen kan få konflikt mellom ticket 11 og øvrige
  tickets. Prototypeticketen bør derfor begrense endringer til
  Treningsøkt-eksemplene, mens implementasjonstickets oppdaterer sine egne
  komponenttilstander i runtime-katalogen.

Denne oppdelingen øker antallet fra åtte til tolv tickets, men reduserer
størrelsen på de mest risikable PR-ene og gjør hver ny delt komponent enklere å
vurdere mot en konkret skjerm.

## Designusikkerhet og prototypebehov

Skjermene klassifiseres etter hvor mye designarbeid som må gjøres før
produksjonsimplementering:

- **A – direkte implementering:** katalogen og reglene dekker skjermen.
- **B – lokal avklaring:** en variant eller responsiv regel må dokumenteres, men
  krever normalt ikke en separat prototype.
- **C – prototypeport:** hele samspillet må prøves interaktivt og godkjennes før
  produksjonsimplementering.

| Skjerm | Klasse | Avklaring |
| --- | --- | --- |
| Oppstart | B | Komplett komposisjon for lasting, gjentatt feil og helsides sikkerhetsstopp |
| Forside | A | Kan bygges direkte fra hero-layout, handlinger og feedback |
| Treningsøkt | C | Informasjonstetthet, tastatur, stor tekst, lokale operasjoner og handlingshierarki må prøves samlet |
| Fullført økt | B | Dialogrekkefølge, opptatt tilstand og stor tekst |
| Historikk | A | Kan bygges direkte fra liste og sidestatus |
| Øvelser | B | Søk, tastatur, rulling og stor tekst |
| Innstillinger | A | Kan bygges direkte som liste med navigasjonsrad |
| Data | C | Hele den flertrinns gjenopprettingen og overgangen til låst sikkerhetsstopp må prøves interaktivt |
| Øvelsesdetalj | B | Redigeringsskjema med tastatur/stor tekst og dialogregler |
| Øvelsesvelger | B | Knapphierarki, opptatt valgrad og modal/tastatur-layout |
| Ny øvelse | B | Tastatur, stor tekst og modal avbryting |

Kartleggingen finner fortsatt ikke behov for en ny grunnkomponent. Usikkerhetene
gjelder varianter, responsiv oppførsel og komposisjon.

### App-header og innholdstitler

Katalogen viser en egen sentrert HTML-header, mens appen bruker native
stack-header. Katalogeksemplene varierer også mellom skjermtittel alene og en
ekstra innholdstittel.

Anbefalt regel:

- Behold native stack-header og style den med designsystemets tokens.
- Behandle katalogheaderen som en visuell kontrakt, ikke som krav om en egen
  React Native-komponent.
- Behold bare eksisterende innholdstitler som uttrykker innholdsidentitet eller
  formål. Ikke innfør nye doble titler under migreringen.

Denne avklaringen blokkerer ticket 1.

### Modal skjerm og avbryting

Katalogen viser avbryt som teksthandling i innholdet, ikke som egen knapp i
modal-headeren.

Anbefalt regel:

- Behold eksplisitt teksthandling for avbryt i innholdet.
- Ikke legg til en ny lukkeknapp i headeren.
- Plattformens tilbake-/lukkegest skal utføre samme avbrytlogikk.
- Både eksplisitt og systemdrevet avbryting blokkeres mens lagring eller valg
  ikke trygt kan avbrytes.

Denne avklaringen blokkerer ticket 2 og 6.

### Tastatur og stor tekst

Den faste katalogvisningen beskriver ikke hvordan felt, feil og handlinger
oppfører seg med skjermtastatur eller stor systemtekst.

Anbefalt regel:

- Skjemaskjermer er rullbare og justeres automatisk for tastaturet.
- Fokusert felt, tilhørende feiltekst og neste relevante handling skal kunne
  rulles over tastaturet.
- Felt, rader og knapper vokser vertikalt; etiketter skal ikke trunkeres.
- Tallfelt stables i én kolonne når to kolonner ikke gir plass til etikett,
  verdi og feiltekst.
- Handlingsgrupper stables i full bredde fremfor å krympe eller trunkere tekst.

Dette er responsiv oppførsel, ikke en ny visuell komponent. En eventuell intern
tastaturtilpasset skjermbeholder er en implementasjonsdetalj. Avklaringen
blokkerer ticket 2, 5, 6, 8, 10 og 11.

### Lokale og helsides gjenopprettingshandlinger

Katalogen viser ulikt hierarki for «Prøv igjen» i helsides og lokale feil.

Anbefalt regel:

- Bruk primær handling i `Sidestatus`, der gjenoppretting er skjermens eneste
  naturlige neste steg.
- Bruk sekundær handling i et lokalt `Feilvarsel`, der resten av skjermen
  fortsatt er gyldig og nyttig.

Dette er en komposisjonsregel, ikke en ny knappetype. Den blokkerer ticket 3, 7,
8, 9 og 11.

### Dialoghandlinger

Dialogtypene er definert, men katalogen mangler en eksplisitt regel for
handlingsrekkefølge, stor tekst og opptatt tilstand.

Anbefalt regel:

- Trygg avbryt-/behold-handling kommer først i leserekkefølgen.
- Bekreftende eller destruktiv handling kommer sist.
- Destruktive handlinger bruker destruktiv variant, også «Fjern øvelse» og
  «Avbryt økten» når data slettes permanent.
- Handlingene stables i full bredde når teksten blir stor.
- Under commit eller sletting deaktiveres alle handlinger, dialogen kan ikke
  avvises, og opptatt status vises på handlingen som startet operasjonen.

Denne avklaringen blokkerer ticket 7, 8, 9 og 11.

### Øvelsesvelger

Katalogen viser «Opprett øvelse» som sekundær når listen har valg, mens den
tidligere komponentmatrisen beskrev handlingen som primær.

Anbefalt regel:

- Når valgbare rader finnes, er valget i listen hovedoppgaven. «Opprett øvelse»
  er sekundær og «Avbryt» er teksthandling.
- Når ingen rad kan fullføre oppgaven, er «Opprett første øvelse» eller
  «Opprett ‹søket›» primær.
- En opptatt valgrad beholder øvelsesnavnet og viser kompakt loader med
  «Legger til …» i etterfølgende plass. Øvrige rader og handlinger deaktiveres.

Dette bruker eksisterende komponenter og blokkerer ticket 6.

### Oppstart

Oppstart bruker en egen helsides komposisjon fordi appens navigasjon ennå ikke
er tilgjengelig.

Anbefalt regel:

- `Sidestatus` sentreres i hele safe-area-flaten uten app-header.
- «Trene» kan beholdes som rolig identitet over statusen i alle tilstander.
- Lasting bruker stor loader og presis statusetikett.
- Første og gjentatte feil bruker samme feilvariant; gjentatt feil legger bare
  til hjelpetekst.
- Sikkerhetsstopp bruker fareikon, overskrift og forklaring, men ingen handling.

Oppstart og Data kan dele feilinnhold og tokens, men skal ikke dele en egen
domenespesifikk sikkerhetsstoppbeholder. Denne avklaringen blokkerer ticket 3.

### Prototypeport for Data

Den statiske katalogen viser forhåndsvisning og sikkerhetsstopp hver for seg,
men ikke overgangene i den sikkerhetskritiske arbeidsflyten. Før produksjonskode
skal en interaktiv prototype vise:

- valg av fil og lokal valideringsfeil
- forhåndsvisning med tidspunkt og innholdstall
- kontroll av nåværende data
- destruktiv sluttbekreftelse
- ikke-avvisbar commit med opptatt status
- vellykket avslutning
- gjenopprettbar commit-feil
- overgang til låst sikkerhetsstopp ved uopprettelig feil
- liten skjerm og stor tekst i alle dialogtrinn

Prototypen skal gjøre det entydig når ingen data er endret, når eksisterende data
skal erstattes, når operasjonen ikke kan avbrytes, og hvorfor sikkerhetsstoppen
ikke viser handlinger. I låst tilstand erstattes dialoginnholdet med fareikon,
egen overskrift, forklaring og instruks om å bevare appdata.

Dette er komposisjoner av eksisterende dialog, datarad og feilinnhold. Ticket 9
er den eksplisitte prototype- og godkjenningsporten som blokkerer
implementasjonen i ticket 10.

### Prototypeport for Treningsøkt

Den nåværende katalogvisningen er ikke tilstrekkelig for skjermens mengde data,
lokale operasjoner og redigering med tastatur. Ticket 11 skal levere en
interaktiv prototype som minst viser:

- tom økt og tydelig «Legg til øvelse»
- normal økt med flere øvelser og sett
- kollapsede og åpne øvelseskort med lange navn
- flere planlagte sett samtidig
- lokal feltfeil, lagringsfeil og retry
- en pågående lokal operasjon og korrekte deaktiverte områder
- tastatur og stor tekst rundt aktiv skjemadel
- handlingsnivåene for sett, øvelse og hele økten
- bekreftelsesdialog og begge destruktive dialoger

Godkjenningskriteriet er at brukeren uten tvil kan se hvilken handling som
gjelder settet, øvelsen eller hele økten, samtidig som aktiv skjemadel forblir
brukbar med tastatur og stor tekst.

Foreslåtte lokale regler som prototypen skal validere:

- Sletting av et ubekreftet planlagt sett er sekundær, fordi den bare fjerner en
  lokal plan. Bekreftede eller historiske data bruker destruktiv handling.
- Tom økt bruker lokal tomtekst med synlig «Legg til øvelse», ikke en helsides
  `Sidestatus`, fordi arbeidsflaten fortsatt er tilgjengelig.

Ticket 12 er blokkert til prototypen er godkjent. Eventuelle nye varianter som
oppdages skal avklares i ticket 11, ikke introduseres under implementeringen.

## Bevaringskrav

Designmigreringen skal bare endre presentasjon. Den skal ikke endre funksjonell
atferd, domeneregler, dataflyt, navigasjon, operasjonsrekkefølge eller
tilgjengelighetsatferd.

Dette innebærer at delte designkomponenter skal motta og videresende eksisterende
refs, roller, navn, hint, tilgjengelighetstilstander, `testID`, hendelser og
deaktivert tilstand uten å endre tidspunktet de brukes på. Domenetilstand og
asynkron orkestrering skal forbli i skjermene; de skal ikke flyttes inn i
generelle designkomponenter.

### Felles kontrakter

- Bevar alle rutenavn, parametere, titler og modalpresentasjoner i
  `src/AppNavigator.tsx`.
- Bevar `WorkoutDraftProvider` utenfor navigasjonsbeholderen.
- Bevar forskjellen mellom lasting, feil, manglende ressurs og legitimt tomt
  innhold. En lesefeil skal aldri vises som tom data.
- Fullfør alltid nødvendige databaseoperasjoner før vellykket navigasjon.
- Bevar all blokkering av kontroller, dialogavvisning og stack-navigasjon mens
  en operasjon ikke trygt kan avbrytes.
- Bevar programmatisk fokus ved feil, dialogåpning, dialoglukking og retur fra
  sletting eller valg.
- Bevar tilgjengelighetsroller, -navn, -hint, -tilstander, live-regioner og
  annonseringer.
- Bevar haptisk feedback og hvilken hendelse som utløser den.
- Bevar synlig tekst og eksplisitte `testID` som brukes av tester og Maestro,
  med mindre testen og den avtalte brukerteksten endres eksplisitt.
- Ikke erstatt native deaktivert oppførsel med bare visuell styling.
- Ikke innfør debounce, parallellisering eller optimistiske endringer i
  operasjoner som i dag er serialiserte og durability-first.
- Bevar rulling, tastaturtyper, blur-lagring og
  `keyboardShouldPersistTaps="handled"` der dette brukes.

### App-shell

- Systemets lyse eller mørke tema velges fortsatt automatisk.
- `Home` forblir første rute.
- `ExercisePicker` og `CreateExercise` forblir modale ruter.
- Native stack og minimal tilbakeknapp beholdes.
- Visuell headerendring skal ikke endre tilbake-, swipe- eller
  maskinvarenavigasjon.

Kilder: `src/AppNavigator.tsx`, `src/theme.ts`.

### Oppstart

- Rekkefølgen skal fortsatt være opprydding av eksport, gjenoppretting av
  avbrutt restore, åpning av database og først deretter montering av appen.
- Navigasjon og barn skal ikke monteres under lasting, feil eller sikkerhetsstopp.
- Vanlig feil tilbyr én manuell retry som kjører hele oppstartssekvensen på nytt.
- Andre og senere feil viser den ekstra veiledningen som finnes i dag.
- Sikkerhetsstopp tilbyr ingen retry, åpner ikke databasen og bevarer
  gjenopprettingsartefakter.
- Aktiv database lukkes dersom oppstarten fullføres etter unmount, og ved senere
  unmount av oppstartsporten.
- Retry får fokus ved vanlig feil. Feilområdene forblir assertive live-regioner,
  og loaderen beholder tilgjengelighetsnavnet `Starter Trene`.

Kilder: `src/StartupGate.tsx`, `src/__tests__/StartupGate.test.tsx`.

### Forside

- Aktiv økt lastes på fokus og når appen kommer tilbake i forgrunnen.
- `Start økt` oppretter økten før navigasjon; `Fortsett økt` gjenbruker den
  eksisterende økten.
- Alle handlinger er deaktivert og stack-fjerning blokkert under oppretting.
- Retry gjør et nytt oppslag av aktiv økt.
- Varsel om ulagrede endringer vises bare for utkast som tilhører den aktive
  økten.
- `focusStartWorkout` fokuserer startknappen én gang og konsumeres deretter.

Kilder: `src/screens/HomeScreen.tsx`,
`src/screens/__tests__/HomeScreen.test.tsx`.

### Historikk

- Listen lastes på fokus og beholder dato, antall øvelser, sortering,
  tilgjengelighetsnavn og navigasjon til riktig fullførte økt.
- Aktiv økt slås bare opp for den tomme historikken.
- Start fra tomtilstand lagrer før navigasjon og blokkerer navigasjon mens den
  pågår. Fortsett åpner eksisterende økt direkte.
- Lesefeil annonseres og fokuserer retry; oppstartsfeil lar tomtilstanden forbli
  brukbar.
- `focusWorkoutId` og `focusEmptyAction` gjenoppretter fokus etter sletting og
  konsumeres først når målet finnes.

Kilder: `src/screens/HistoryScreen.tsx`,
`src/screens/__tests__/HistoryScreen.test.tsx`.

### Øvelser

- Listen lastes på fokus. Eksisterende innhold beholdes mens en senere
  fokusoppdatering pågår.
- Sortering, bruksantall og entall/flertall beholdes.
- Søk forblir normalisert, lokaltilpasset og ikke-versalfølsomt delstrengsøk.
- Helt tom katalog, ingen søkeresultater og lesefeil forblir tre ulike
  tilstander med dagens navigasjonsparametere.
- `focusExerciseId` kan tømme et søk som skjuler målet før fokus flyttes.
  `focusEmptyAction` fokuserer opprett-handlingen etter siste sletting.

Kilder: `src/screens/ExercisesScreen.tsx`,
`src/screens/__tests__/ExercisesScreen.test.tsx`.

### Øvelsesvelger

- Tilgjengelige øvelser og totalt antall lastes og brukes til å skille mellom
  tom installasjon, alle allerede lagt til og ingen søketreff.
- Søkefeltet fokuseres automatisk når valg er tilgjengelige.
- Valg lagres før retur til Treningsøkt med `focusExerciseId`.
- Under lagring deaktiveres søk, alle rader, handlinger og stack-fjerning. Valgt
  rad beholder opptatt og deaktivert tilgjengelighetstilstand.
- Feil beholder søk og valg, gjenaktiverer skjermen og navigerer ikke.
- Oppretting beholder `origin: 'workout'`, `workoutId` og eventuell
  `initialName`.
- Avbryt gjør ingen mutasjon og returnerer med `focusAddExercise`.

Kilder: `src/screens/ExercisePickerScreen.tsx`,
`src/screens/__tests__/ExercisePickerScreen.test.tsx`.

### Ny øvelse

- `initialName` beholdes som første utkast, feltet autofokuseres, og både knapp
  og tastatur kan sende inn skjemaet.
- Normalisering, validering, duplikatkontroll og grensen på 100 grafemer endres
  ikke.
- Vanlig oppretting erstatter ruten med Øvelsesdetalj. Oppretting fra en økt
  legger øvelsen atomisk til og returnerer med `focusExerciseId`.
- Validerings- og lagringsfeil beholder teksten, annonseres og refokuserer feltet.
- Felt, lagring, avbryt og stack-fjerning er deaktivert under lagring.
- `exercise-name-input` og `create-exercise-submit` beholdes.

Kilder: `src/screens/CreateExerciseScreen.tsx`,
`src/screens/__tests__/CreateExerciseScreen.test.tsx`.

### Fullført økt

- Lasting, lesefeil, manglende økt og ferdig innhold forblir separate tilstander.
- Tidspunkt, øvelsesrekkefølge, settrekkefølge og formatterte verdier beholdes.
- `fromCompletion` beholder egen tilbakeflyt til Forside; vanlig åpning beholder
  tilbakeflyt til Historikk.
- Sletting krever bekreftelse. Dialogen fokuserer bekreftelse ved åpning og
  gjenoppretter fokus til utløseren ved avbryt.
- Under sletting deaktiveres begge dialoghandlinger, dialogavvisning og
  stack-fjerning.
- Vellykket sletting bruker databasens tilstøtende `focusWorkoutId`, eller
  `focusEmptyAction` etter siste sletting.
- Feil lukker dialogen, beholder detaljen og lar retry åpne bekreftelsen på nytt;
  retry skal ikke slette direkte.

Kilder: `src/screens/CompletedWorkoutScreen.tsx`,
`src/screens/__tests__/CompletedWorkoutScreen.test.tsx`.

### Øvelsesdetalj

- Lasting, lesefeil, manglende øvelse og ferdig innhold forblir separate.
- Historikkrekkefølge, settrekkefølge og formattering beholdes. Tom historikk er
  lokal og skjuler ikke redigering.
- Endring av navn bruker samme normalisering og validering som oppretting, og
  lagrer før skjermens identitet endres.
- Den synkrone operasjonsvakten mot doble rename-/delete-kall beholdes.
- Sletting vises bare når øvelsen kan slettes.
- Slettedialog, fokusflyt, blokkering og tilstøtende fokus etter sletting
  beholdes.
- Generell slettefeil tilbyr retry av innlasting og lukk, ikke direkte ny
  sletting. Endret slettbarhet og manglende ressurs beholder egne feilforløp.

Kilder: `src/screens/ExerciseDetailScreen.tsx`,
`src/screens/__tests__/ExerciseDetailScreen.test.tsx`.

### Innstillinger

- Hele Data-raden forblir én knapp som navigerer til `Data`.
- `settings-data` beholdes for backup-, restore- og interruption-flytene.
- Automatisk safe-area-innsetting beholdes.

Kilde: `src/screens/SettingsScreen.tsx`.

### Data

- Backup og restore forblir gjensidig blokkert mens en av dem arbeider.
- Backup kjører fortsatt eksklusivt, verifiserer artefakter før deling, rydder
  midlertidige filer og behandler lukket delingsark som normal retur.
- Avbrutt filvalg er fortsatt en no-op. Restore valideres og klargjøres før
  forhåndsvisning; forhåndsvisningstall leses fra den klargjorte databasen.
- Forhåndsvisning og destruktiv bekreftelse forblir to trinn. Ingen data endres
  før `Erstatt og gjenopprett`.
- Avbryt og plattformtilbake rydder klargjort restore og gjenoppretter fokus når
  det er trygt. Under commit deaktiveres handlinger, dialogavvisning og
  stack-fjerning.
- Commit beholder hele validerings-, rollback-, erstatnings-,
  revaliderings- og remount-rekkefølgen.
- Gjenopprettbar commit-feil lukker dialogen, rydder og bekrefter at opprinnelige
  data er tilbake. Den tilbyr ikke direkte commit-retry.
- Uopprettelig feil beholder artefakter, viser låst dialog uten handlinger og
  lar neste oppstart forsøke gjenoppretting.
- Fokus, tilgjengelighetshint, busy-/disabled-tilstander og annonseringer
  beholdes.
- Følgende `testID` beholdes: `create-backup`, `restore-from-file`, `data-error`,
  `restore-preview`, `restore-confirmation`, `cancel-restore`,
  `continue-restore` og `confirm-restore`.

Kilder: `src/screens/DataScreen.tsx`, `src/screens/__tests__/DataScreen.test.tsx`,
`src/backup/` og `.maestro/android-backup/`/`.maestro/ios/`.

### Treningsøkt

Treningsøkt har den største atferdsoverflaten. Ticket 11 skal prototype
presentasjonen uten å forenkle følgende kontrakter, og ticket 12 skal bevare dem
ved implementering.

- Økten lastes på fokus. Første øvelse åpnes som standard, med mindre en
  returparameter peker på en annen øvelse eller Legg til-handlingen.
- Bare ett øvelseskort er åpent samtidig. Bekreftede sett sorteres før planlagte
  sett med dagens stabile rekkefølge.
- Utkast forblir strengverdier i delt state og overlever navigasjon.
- Belastning og repetisjoner beholder dagens valideringsgrenser, tastaturtyper og
  formattering.
- Blur-lagring, serialisert lagringskø, stopp etter første feil og eksplisitt
  manuell retry beholdes. Automatisk blur eller foreground skal ikke forsøke et
  allerede feilet utkast på nytt.
- Gyldig felt kan lagres selv om det andre feltet har ugyldig tekst; ugyldig tekst
  beholdes synlig mens forrige lagrede verdi brukes.
- Bekreftelse validerer begge felt før én atomisk databaseoperasjon. Ved feil
  fokuseres første ugyldige felt eller relevant retry.
- Redigering av et bekreftet sett opphever bekreftelsen på samme stabile rad.
  Sletting gjelder bare planlagte sett.
- Legg til sett og Legg til øvelse flusher utkast først og fortsetter bare hvis
  alt som skal lagres lykkes.
- En øvelse med bare planlagte sett fjernes direkte. En øvelse med bekreftede sett
  krever dialog. Bare medlemskapet og øktens sett slettes, ikke katalogøvelsen.
- `Ferdig` krever minst ett varig bekreftet sett og er deaktivert ved pågående,
  dirty eller feilet arbeid. Fullføring fjerner ubekreftede sett atomisk før
  navigasjon til kvitteringen.
- Avbryt krever alltid bekreftelse og sletter den aktive økten først etter
  bekreftelse.
- Alle vellykkede navigasjoner skjer først etter varig databaseendring. Feil
  beholder data og relevant skjermkontekst.
- `usePreventRemove`-flyten, flush før navigasjon og tillatt navigasjon etter
  vellykket fullføring/avbryting beholdes.
- Ved bakgrunning flushes aktuelle utkast. Ved retur ventes det på flush før
  SQLite lastes på nytt.
- Eksisterende fokusflyt, tilgjengelighetsnavn, feltkoblinger, annonseringer og
  haptikk per hendelse beholdes.
- Dialoger kan ikke avvises under destruktive operasjoner og gjenoppretter fokus
  ved trygg avbryting.

Kilder: `src/screens/WorkoutScreen.tsx`, `src/workoutDrafts.tsx`,
`src/domain/workoutSet.ts`, `src/screens/__tests__/WorkoutScreen.test.tsx` og
`src/database/__tests__/workouts.test.ts`.

### Automatiseringskontrakter

Eksplisitte `testID` og tekstbaserte Maestro-selektorer er del av
regresjonsflaten. Komponentuttrekk skal ikke fjerne eller flytte identifikatorer
til et utilgjengelig undernivå. Særlig gjelder dette:

- `exercise-name-input`
- `create-exercise-submit`
- `settings-data`
- alle åtte Data-`testID` listet over
- synlige og tilgjengelige navn for start/fortsett, opprett, lagre, slett,
  fullfør, avbryt, legg til og tilbakehandlinger

Der en visuell endring krever annen synlig tekst, må det behandles som en egen
funksjonell beslutning og ikke skjules i designmigreringen.

## Test- og verifikasjonsdekning

Alle implementasjonstickets skal minst kjøre:

```sh
npm run typecheck
npm test -- --ci
```

Nye regresjons- og karakteriseringstester for eksisterende atferd skal skrives
og kjøres grønne før produksjonsdesignet endres. Først når den nåværende
kontrakten er bevist, kan komponentuttrekk og visuell migrering begynne. Tester
som med vilje beskriver en ny, godkjent presentasjonstilstand kan endres eller
legges til sammen med implementeringen, men skal ikke samtidig endre funksjonell
atferd.

Før sammenslåing av hele migreringen kjøres også:

```sh
npm run verify
```

Skjermtestene er hovedvernet mot funksjonelle regresjoner. Nye tester for delte
komponenter skal bare dekke kontrakter som ikke blir robust verifisert gjennom
skjermene: videresending av refs, `testID`, tilgjengelighetsprops, native
deaktivering, felthendelser og dialogavvisning. Det skal ikke innføres snapshots
av stilobjekter eller én test per fargetoken.

### Verifikasjonsmatrise

| Ticket | Smal automatisert dekning | Native verifikasjon | Viktigste hull som må lukkes |
| --- | --- | --- | --- |
| 1 Tema og app-shell | Ny fokusert test av tema- og navigasjonskontrakten | Android og iOS-simulator | Temaendring under åpen skjerm/modal, native header, tilbakeflyt og stor tekst |
| 2 Kontroller og Ny øvelse | `CreateExerciseScreen`, `exerciseName`, relevante databaseoperasjoner og kontrollkontrakter | Android og iOS-simulator | Autofokus, tastatur-submit, lagringsfeil, busy/blokkert avbryt og prop-/ref-videresending |
| 3 Feedback, Forside og Oppstart | `HomeScreen`, `StartupGate`, `DatabaseRuntime`, `recoverRestore` | Android og iOS-simulator | Home-feil/retry, oppstartsloader, retry-fokus, eksplisitt oppstartsrekkefølge og runtime-lukking |
| 4 Navigasjonslister, Innstillinger og Historikk | `HistoryScreen`, `locale`, `workouts` og ny `SettingsScreen`-test | Android og iOS-simulator | Innstillinger-kontrakt, loading-label og busy tomtilstand |
| 5 Søkbar liste og Øvelser | `ExercisesScreen`, `exercises`, `exerciseName` | Android og iOS-simulator | Fokus-refresh, retry-fokus, loading-label, tastatur og en ny søke-Maestro-flyt |
| 6 Valgflyt og Øvelsesvelger | `ExercisePickerScreen`, `CreateExerciseScreen`, `workouts` | Android og iOS-simulator | Autofokus, alle kontroller blokkert under valg, retry med bevart søk og ny valg-Maestro-flyt |
| 7 Kort, dialog og Fullført økt | `CompletedWorkoutScreen`, `workouts`, `locale` og dialogkontrakter | Android og iOS-simulator | Blokkert plattformtilbake, stack-blokkering, busy-state og ny slette-Maestro-flyt |
| 8 Øvelsesdetalj | `ExerciseDetailScreen`, `exerciseName`, `exercises`, `locale` | Android og iOS-simulator | Rename-busy, dobbel delete-vakt, blokkert dialoglukking og tastatur |
| 9 Prototype Data | Ingen ny Jest-test når bare prototypen endres | Ikke påkrevd | Manuell godkjenning av hele flyten i lys/mørk, smal bredde og stor tekst |
| 10 Data | `DataScreen`, alle backup-tester, `DatabaseRuntime`, `inspectDatabase`, `locale` | Full Android- og iOS-restoreverifikasjon | ID-kontrakter, fokus ved avbryt, annonseringer, commit-lås og visuell kontroll av alle sikkerhetstilstander |
| 11 Prototype Treningsøkt | Ingen ny Jest-test når bare katalogen endres | Ikke påkrevd | Manuell godkjenning av alle prototypetilstander i lys/mørk, smal bredde og stor tekst |
| 12 Treningsøkt | `WorkoutScreen`, `HomeScreen`, `workoutSet`, `workouts` | Full Android smoke/qualification og iOS-simulator | Route-fokus, `usePreventRemove`, flush før navigasjon, feltkontrakter, busy-dialoger og ny tett feil/busy-flyt |

### Ticket 1: tema og app-shell

Det finnes ingen direkte tester av `src/theme.ts` eller `src/AppNavigator.tsx`.
Ticketen skal legge til én fokusert kontrakttest som dekker:

- automatisk valg av lyst og mørkt tema
- uendrede rutenavn, rekkefølge og titler
- `Home` som første rute
- modalpresentasjon av Øvelsesvelger og Ny øvelse
- minimal tilbakeknapp
- `WorkoutDraftProvider` rundt navigasjonsbeholderen

En separat tematest er bare nødvendig hvis tokenene avledes eller transformeres;
statiske tester av hver fargeverdi gir liten verdi. Native kontroll kreves på
Android og iOS-simulator fordi header, safe area, statuslinje, swipe og
modalpresentasjon ikke kan verifiseres i Jest.

### Ticket 2: kontroller og Ny øvelse

Eksisterende dekning:

- `src/screens/__tests__/CreateExerciseScreen.test.tsx`
- `src/domain/__tests__/exerciseName.test.ts`
- relevante tilfeller i `src/database/__tests__/exercises.test.ts` og
  `src/database/__tests__/workouts.test.ts`

Ticketen skal supplere med autofokus, `onSubmitEditing`, generisk lagringsfeil,
deaktivering og navigasjonsblokkering under lagring. En liten komponenttest skal
bevise at knapper og felt videresender ref, `testID`, rolle, navn, hint,
tilstand, native `disabled`/`editable` og hendelser.

Relevant runtimeflyt er `.maestro/smoke/create-exercise.yaml`. Tastatur,
feltfeil, stor tekst, eksplisitt avbryt og plattformavbryt må i tillegg prøves
manuelt på Android og iOS-simulator.

### Ticket 3: feedback, Forside og Oppstart

Eksisterende dekning:

- `src/screens/__tests__/HomeScreen.test.tsx`
- `src/__tests__/StartupGate.test.tsx`
- `src/database/__tests__/DatabaseRuntime.test.ts`
- `src/backup/__tests__/recoverRestore.test.ts`

Manglende regresjonstester er feil og retry ved oppslag/start på Forside,
deaktivering av alle handlinger under oppretting, oppstartsloaderens navn,
retry-fokus, eksplisitt oppstartsrekkefølge og lukking av runtime ved unmount.

Vanlige smoke-flyter dekker Forside. Sikkerhetsstopp dekkes av
`rollback-failure` for Android og iOS. Vanlig og gjentatt oppstartsfeil må
fremprovoseres manuelt dersom ingen stabil automatiseringsfixture finnes.

### Ticket 4: navigasjonslister, Innstillinger og Historikk

Eksisterende dekning:

- `src/screens/__tests__/HistoryScreen.test.tsx`
- `src/__tests__/locale.test.ts`
- relevante tilfeller i `src/database/__tests__/workouts.test.ts`

Det finnes ingen test for Innstillinger. Ticketen skal legge til én som sikrer at
hele Data-raden er én knapp, navigerer til `Data`, beholder `settings-data` og
beholder automatisk safe-area-innsetting. Historikktesten suppleres bare med
loading-label og eventuell busy-tilstand som ikke allerede dekkes.

`.maestro/smoke/browse-completed-workout.yaml` dekker tom og fylt Historikk.
Alle backup-flytene går gjennom Innstillinger.

### Ticket 5: søkbar liste og Øvelser

Eksisterende dekning:

- `src/screens/__tests__/ExercisesScreen.test.tsx`
- `src/database/__tests__/exercises.test.ts`
- `src/domain/__tests__/exerciseName.test.ts`

Ticketen skal supplere skjermtesten med bevart innhold under fokus-refresh,
loading-label, retry-annonsering/fokus og tastaturkontrakten. Søkefeltets delte
test dekker `editable`, ref og felthendelser.

Ingen eksisterende Maestro-flyt bruker søk. Ticketen skal derfor legge til en
smal Android-flyt for treff og ingen treff. Eksisterende `create-exercise` og
`manage-exercise-history` beholdes som regresjon for tom, fylt, rename og
sletting.

### Ticket 6: valgflyt og Øvelsesvelger

Eksisterende dekning:

- `src/screens/__tests__/ExercisePickerScreen.test.tsx`
- `src/screens/__tests__/CreateExerciseScreen.test.tsx`
- relevante tilfeller i `src/database/__tests__/workouts.test.ts`

Testen for opptatt rad må med vilje tilpasses den godkjente presentasjonen:
øvelsesnavnet beholdes som identitet, mens loader og `Legger til …` vises i
etterfølgende plass. Ticketen skal også dekke autofokus, all deaktivering under
valg, stack-blokkering, bevart søk ved feil og systemdrevet avbryt.

Dagens smoke-flyter dekker bare tom katalog og oppretting. Ticketen skal legge
til en fokusert Android-flyt med eksisterende øvelser, søk, valg, avbryt og
alle-allerede-lagt-til. iOS swipe-avbryt og tastaturlayout prøves manuelt.

### Ticket 7: kort, dialog og Fullført økt

Eksisterende dekning:

- `src/screens/__tests__/CompletedWorkoutScreen.test.tsx`
- relevante tilfeller i `src/database/__tests__/workouts.test.ts`
- `src/__tests__/locale.test.ts`

Skjermtesten dekker allerede de fleste viktige flytene. Ticketen skal supplere
med blokkert `onRequestClose`, stack-blokkering og eksplisitt busy-state under
sletting. En delt dialogtest dekker native modal, modal avgrensning,
handlingsrekkefølge, refs og avvisningscallback.

`browse-completed-workout.yaml` dekker lesing, men ikke sletting. Ticketen skal
legge til en smal Android-flyt som avbryter og deretter fullfører sletting.

### Ticket 8: Øvelsesdetalj

Eksisterende dekning:

- `src/screens/__tests__/ExerciseDetailScreen.test.tsx`
- `src/domain/__tests__/exerciseName.test.ts`
- `src/database/__tests__/exercises.test.ts`
- `src/__tests__/locale.test.ts`

Dekningen er omfattende. Manglende tilfeller er rename-busy med blokkert
navigasjon, synkron vakt mot doble delete-kall, ignorert dialoglukking under
sletting, loading-label og tastaturkontrakten.

`manage-exercise-history.yaml` dekker rename og vellykket sletting.
Restore-success eller offline-kvalifisering dekker historikk med data. Feil- og
busytilstandene prøves manuelt.

### Ticket 9: prototype for Data

Ticketen endrer ikke produksjonskode og trenger normalt ingen nye Jest- eller
Maestro-tester. Den interaktive prototypen vurderes i lyst og mørkt tema, smal
viewport og stor tekst mot prototypekravene over. Godkjenningen dokumenteres før
ticket 10 starter.

### Ticket 10: Data

Eksisterende dekning:

- `src/screens/__tests__/DataScreen.test.tsx`
- alle testene under `src/backup/__tests__/`
- `src/database/__tests__/DatabaseRuntime.test.ts`
- `src/database/__tests__/inspectDatabase.test.ts`
- `src/__tests__/locale.test.ts`

Ticketen skal supplere med eksplisitt bevaring av alle åtte `testID`, blokkering
av motsatt hovedhandling under backup, ignorert dialoglukking under commit,
assertiv sikkerhetsstopp, fokus tilbake til restore-handlingen og feil ved lesing
av nåværende antall.

Native verifikasjon er obligatorisk. Relevante Android-flyter er minst
`restore-success`, `restore-failure`, `rollback-failure` og `accessibility`.
Interruption-flytene kjøres dersom dialog-, commit- eller oppstartskomposisjonen
endres. På iOS kjøres minst `restore-success`, `restore-failure` og
`rollback-failure`. Full backup-/restore-matrise er passende før denne
sikkerhetskritiske ticketen ferdigstilles.

Android-flytene krever en automation-aktivert APK og tilgang til appens private
filer. Interruption krever rootbar API 34 AOSP-/Google APIs-emulator. iOS krever
release simulatorbygg, Xcode, CocoaPods, Maestro og støttet simulatorruntime.

### Ticket 11: prototype for Treningsøkt

Ticketen endrer ikke produksjonskode og trenger normalt ingen nye Jest- eller
Maestro-tester. Katalogen kjøres med:

```sh
npm run prototype:components
```

Alle avtalte tilstander vurderes manuelt i lyst og mørkt tema, smal viewport og
stor tekst. Dersom produksjonsnære filer berøres, kjøres i tillegg
`WorkoutScreen.test.tsx` og typekontroll.

### Ticket 12: Treningsøkt

Eksisterende dekning:

- `src/screens/__tests__/WorkoutScreen.test.tsx`
- `src/screens/__tests__/HomeScreen.test.tsx`
- `src/domain/__tests__/workoutSet.test.ts`
- `src/database/__tests__/workouts.test.ts`

Ticketen skal supplere med loading/total feil, route-drevet fokus, eksplisitt
`usePreventRemove`, flush før legg til/navigasjon, tastaturtyper, feltkoblinger,
busy/deaktivert dialogtilstand og ignorert dialoglukking under commit. Eksisterende
stilspesifikk test flyttes til komponentnivå der det er nødvendig, men
skjermens atferdstester beholdes.

Android-verifikasjon krever en klar emulator, ADB, installert app og Metro for
iterasjon. Port 8081 må være ledig før `npm run start:android`; hvis ikke skal
den eksisterende prosessen behandles som brukereid. Dersom ny APK kreves,
kontrolleres Android build broker før implementering.

Før push kjøres full vanlig Android-smoke og release-lik kvalifisering. iOS har
ingen Treningsøkt-Maestro-flyt, så start, opprett/velg, rediger,
bakgrunn/forgrunn, fullfør og avbryt må prøves manuelt i simulator.

Ticketen skal også legge til en fokusert Android-flyt for en tett økt med
feil/opptatt tilstand; dagens flyter dekker i hovedsak én øvelse og ett sett.

### Native minimumskrav

- Alle produksjonstickets med synlige endringer krever kontroll på reell native
  runtime, ikke bare katalog og Jest.
- Android er minste automatiserte runtime for vanlige skjermer.
- iOS kontrolleres i simulator når ticketen påvirker native header, modal,
  tastatur, tilbake-/swipeatferd eller fokus.
- Data krever begge plattformer og relevante backup-/restore-flyter.
- Treningsøkt krever full Android smoke/qualification og manuell
  iOS-simulatorregresjon.
- TalkBack eller VoiceOver brukes når roller, fokus, dialoger, felt eller
  handlingsrekkefølge endres.
- Lyst og mørkt tema, stor tekst og relevante loading-, tom-, feil-, opptatt-,
  deaktivert- og dialogtilstander kontrolleres manuelt. Dagens Maestro-flyter
  dekker ikke dette systematisk.

Fysisk iPhone er ikke tilgjengelig for denne migreringen. iOS-simulator og
eksisterende iOS-CI brukes der de kan, og manglende fysisk kontroll rapporteres
som restrisiko i relevante PR-er. Dette er ikke en blokkering for ticketene.

## Skjermbildegrunnlag

Alle implementasjonstickets gir synlige endringer og følger
`docs/pr-screenshots/README.md`. Før- og etterbilder tas på samme
Android-emulator med identisk oppløsning, tema, tekstskalering, tastatur,
locale, data og navigasjonstilstand. `before` tas fra detached `origin/main` og
`after` fra ticket-branchen.

Android-emulatoren er kanonisk kilde for sammenlignbare PR-bilder.
iOS-simulatorbilder er supplerende når native header, modal eller tastatur er
særlig relevant, men erstatter ikke de matchede Android-parene.

### Skjermbilder per ticket

| Ticket | Obligatoriske før-/etter-par |
| --- | --- |
| 1 Tema og app-shell | Forside lys; Øvelser med stack-header mørk; Ny øvelse som modal med stor tekst |
| 2 Kontroller og Ny øvelse | Skjema med tastatur lys; feltfeil mørk/stor tekst; lagring med opptatte/deaktiverte kontroller |
| 3 Feedback, Forside og Oppstart | Forside klar lys; Forside starter mørk; oppstart laster; gjentatt oppstartsfeil; sikkerhetsstopp mørk/stor tekst |
| 4 Navigasjonslister, Innstillinger og Historikk | Innstillinger lys; fylt Historikk mørk; tom Historikk under oppstart med stor tekst |
| 5 Søkbar liste og Øvelser | Aktivt søk med treff og tastatur lys; ingen treff med tastatur mørk/stor tekst |
| 6 Valgflyt og Øvelsesvelger | Valgbare rader med tastatur/stor tekst; opptatt valgrad mørk; valgfeil med bevart søk |
| 7 Kort, dialog og Fullført økt | Oppsummering med flere kort lys; slettedialog mørk/stor tekst; sletting pågår lys |
| 8 Øvelsesdetalj | Langt navn og flere historikkort lys; navnefeil med tastatur mørk/stor tekst; sletting pågår i dialog |
| 9 Prototype Data | Godkjenningsbilder av valideringsfeil, forhåndsvisning, destruktiv bekreftelse, commit, gjenopprettbar feil og sikkerhetsstopp |
| 10 Data | Klar skjerm lys; backup pågår mørk; restore-forhåndsvisning lys/stor tekst; destruktiv bekreftelse mørk/stor tekst; commit pågår; låst sikkerhetsstopp mørk/stor tekst |
| 11 Prototype Treningsøkt | Godkjenningsbilder, ikke før-/etter-par; se egen liste nedenfor |
| 12 Treningsøkt | Tom økt; tett økt mørk; feltfeil med tastatur/stor tekst; lagringsfeil; lokal operasjon pågår; fullføringsdialog; begge destruktive dialoger |

### Stabile fixtures

- Tema/app-shell bruker tom aktiv økt og minst tre øvelser.
- Historikk bruker én tom database og én database med nøyaktig tre fullførte
  økter på faste tidspunkt.
- Øvelseslister bruker seks alfabetisk stabile øvelser, inkludert ett langt
  navn, og faste søk med flere eller ingen treff.
- Øvelsesvelger bruker en aktiv økt med én valgt og tre tilgjengelige øvelser.
- Fullført økt bruker to øvelser med tre sett hver og faste tidspunkt.
- Øvelsesdetalj bruker et langt navn og historikk fra to faste økter.
- Data bruker en versjonert restore-fil med fast tidspunkt og faste tellinger,
  samt kjente nåværende tellinger.
- Treningsøkt bruker tre navngitte øvelser med lange navn, flere bekreftede og
  planlagte sett og faste feltverdier.

Feil og opptatte tilstander skal bruke kontrollerte fixtures eller ufullførte
løfter. De skal ikke avhenge av tilfeldig timing, nettverksfeil eller tilfeldig
ødelagte filer.

### Prototypebilder for ticket 11

Ticket 11 dokumenterer designgodkjenningen med minst disse bildene:

- tom økt i lyst tema
- tett økt i mørkt tema
- lange navn med åpne og kollapsede kort
- feltfeil med simulert tastatur og stor tekst
- lagringsfeil med retry
- lokal operasjon i opptatt tilstand
- fullføringsdialog med stor tekst
- dialog for å fjerne øvelse
- dialog for å avbryte økten

Bruk fast smal viewport, for eksempel `390 x 844`. Bildene navngis med
`approval-` og trenger ikke et `origin/main`-motstykke.

### Filnavn

Bruk ASCII-navn og identisk suffiks for hvert par:

```text
docs/pr-screenshots/<issue-number>/before-android-<screen>-<state>.png
docs/pr-screenshots/<issue-number>/after-android-<screen>-<state>.png
docs/pr-screenshots/<issue-number>/before-ios-<screen>-<state>.png
docs/pr-screenshots/<issue-number>/after-ios-<screen>-<state>.png
docs/pr-screenshots/<issue-number>/approval-<screen>-<state>.png
```

Tema og særtilstander tas med i navnet, for eksempel
`form-error-dark-large-text-keyboard`.

### Transiente tilstander

- Hold asynkrone operasjoner i et eksplisitt fixture-stoppunkt. Ikke forsøk å
  treffe en kort spinner manuelt.
- Ta bildet etter at layout, tastatur og dialog er ferdig animert, mens den
  kontrollerte operasjonen fortsatt er opptatt.
- Bruk samme fixturemekanisme på `origin/main` og ticket-branchen.
- Frys datoer, tellinger, rekkefølge og tekstverdier.
- Ikke rediger bilder eller simuler opptatt/feil bare visuelt.
- Hvis en tilstand ikke kan frembringes deterministisk på `origin/main`,
  dokumenteres avviket i PR-en og automatisert bevis brukes i stedet for et
  umatchet bildepar.

### Restrisiko for iOS

Uten fysisk iPhone gjenstår risiko knyttet til reelle safe areas, Dynamic Type,
tastaturvarianter, swipe-gester, VoiceOver, haptikk, filvelger/delingsark og
ytelse under native operasjoner. Simulator og iOS-CI reduserer denne risikoen.
Data og Treningsøkt bør få fysisk iPhone-regresjon før en senere
produksjonsrelease, men dette blokkerer ikke migreringsticketene.
