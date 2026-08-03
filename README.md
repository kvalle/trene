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
