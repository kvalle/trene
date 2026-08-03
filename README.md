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

Testen begynner med `clearState: true` og sletter derfor eksisterende appdata på
emulatoren. Maestro Studio kan også åpne samme YAML-fil for visuell steg-for-steg-
kjøring og inspeksjon.
