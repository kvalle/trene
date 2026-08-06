#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/trene.apk}"
phase="${1:-all}"

mkdir -p "$(dirname "$apk")" "$PWD/.artifacts/expo"

export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"

if [[ "$phase" == "prebuild" || "$phase" == "all" ]]; then
  # Restore native build state only after this generated project exists.
  npx expo prebuild --platform android --no-install
fi

if [[ "$phase" == "assemble" || "$phase" == "all" ]]; then
  ./android/gradlew -p android \
    --build-cache \
    --no-daemon \
    --console=plain \
    assembleRelease 2>&1 | tee "$PWD/.artifacts/android/gradle-build.log"
  cp android/app/build/outputs/apk/release/app-release.apk "$apk"
fi

if [[ "$phase" != "prebuild" && "$phase" != "assemble" && "$phase" != "all" ]]; then
  echo "Usage: $0 [prebuild|assemble|all]" >&2
  exit 2
fi
