# Trene

Expo/React Native-appen for lokal registrering av styrketrening.

## Plattformstøtte

Prosjektet bruker Expo SDK 57 og følger denne versjonens laveste støttede
plattformer: Android 7 (API 24) og iOS 16.4. Verdiene er eksplisitt satt med
`expo-build-properties` i `app.json`. Android kompileres og målrettes mot API 36.

## Utvikling

```sh
npm install
npm start
```

For Android-emulator brukes `npm run start:android`. Den setter opp ADB-tunnelen,
starter Metro med IPv4-støtte og annonserer `127.0.0.1`, slik at emulatoren ikke
er avhengig av å nå maskinens LAN-adresse.

Kjør `npm run android` eller `npm run ios` for en lokal native-bygg. En direkte
installerbar Android APK kan bygges med `eas build --platform android --profile preview`.

## Verifisering

```sh
npm run typecheck
npm test
npx expo-doctor
```

### Android smoke-test med Maestro

Maestro kjører appen som en bruker gjennom native tilgjengelighetstreet. Flyten i
`.maestro/smoke/create-exercise.yaml` oppretter `Knebøy`, restarter appen og
verifiserer at øvelsen fortsatt finnes i SQLite.

Installer først [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)
og kontroller at Java 17 eller nyere er aktivt:

```sh
brew tap mobile-dev-inc/tap
brew trust --formula mobile-dev-inc/tap/maestro
brew install mobile-dev-inc/tap/maestro
java -version
```

Start en Android-emulator med API 29, 30, 31, 33 eller 34. Bygg og installer
appen i én terminal, la Metro fortsette å kjøre, og start testen i en annen:

```sh
npm run android
npm run smoke:android
```

Hvis appen allerede er installert, start Metro separat med
`npm run start:android` før smoke-testen.

Kommandoen bruker prosjektlokal Maestro-tilstand under `.artifacts/maestro/` og
fungerer både lokalt og gjennom cplt-sandkassen.

Runneren sletter eksisterende appdata på emulatoren før hver smoke-flyt. Maestro
Studio kan også åpne samme YAML-fil for visuell steg-for-steg-kjøring og
inspeksjon, men nullstiller ikke appdata automatisk.
