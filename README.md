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

Run `npm run android` or `npm run ios` for a local native build. CI builds a
standalone, directly installable universal release APK as the
`trene-android-apk` artifact. It requires neither Metro nor networking. Build
the same APK locally with `bash scripts/build-android-smoke-apk.sh`.

## Verifisering

```sh
npm run typecheck
npm test
npx expo-doctor
```

`npm run verify` runs all three checks. CI also compiles an iOS release build for
the simulator and runs the Android qualification described below.

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

### Standalone offline qualification

CI runs every flow in `.maestro/smoke/` and the combined
`.maestro/qualification/offline-mvp.yaml` against clean app data. The latter
verifies recording, force-stop, resume, completion, and both history views. CI
disables and verifies the absence of networking before installing the app, and
runs without Metro. With a release APK installed locally, run the flows with:

```sh
npm run qualify:android
```

The manual device matrix and traceability for all 16 scenarios are documented in
[`docs/mvp-qualification.md`](docs/mvp-qualification.md).
