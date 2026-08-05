#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/app-debug.apk}"

mkdir -p "$(dirname "$apk")" "$PWD/.artifacts/expo"

export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"

# Generate the native project from the same Expo inputs used by run:android.
npx expo prebuild --platform android --no-install
./android/gradlew -p android --no-daemon -PreactNativeArchitectures=x86_64 assembleDebug
cp android/app/build/outputs/apk/debug/app-debug.apk "$apk"
