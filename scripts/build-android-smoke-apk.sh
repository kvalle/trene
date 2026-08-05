#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/app-debug.apk}"
phase="${1:-all}"

mkdir -p "$(dirname "$apk")" "$PWD/.artifacts/expo"

export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"

if [[ "$phase" == "prebuild" || "$phase" == "all" ]]; then
  # Restore native build state only after this generated project exists.
  npx expo prebuild --platform android --no-install
fi

if [[ "$phase" == "assemble" || "$phase" == "all" ]]; then
  ./android/gradlew -p android \
    --no-daemon \
    --console=plain \
    -PreactNativeArchitectures=x86_64 \
    assembleDebug 2>&1 | tee "$PWD/.artifacts/android/gradle-build.log"
  cp android/app/build/outputs/apk/debug/app-debug.apk "$apk"
fi

if [[ "$phase" != "prebuild" && "$phase" != "assemble" && "$phase" != "all" ]]; then
  echo "Usage: $0 [prebuild|assemble|all]" >&2
  exit 2
fi
