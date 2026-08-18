#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/trene.apk}"

mkdir -p .artifacts

cleanup() {
  adb shell ip link set eth0 up >/dev/null 2>&1 || true
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell svc data enable >/dev/null 2>&1 || true
  df -h > .artifacts/runner-disk.txt 2>&1 || true
  free -h > .artifacts/runner-memory.txt 2>&1 || true
  if [[ -d .artifacts/maestro/debug/.maestro ]]; then
    cp -R .artifacts/maestro/debug/.maestro .artifacts/maestro/debug/maestro || true
  fi
}
trap cleanup EXIT

if [[ ! -f "$apk" ]]; then
  echo "Standalone Android APK not found: $apk" >&2
  exit 1
fi

adb uninstall com.kjetilvalle.trene >/dev/null 2>&1 || true
adb root >/dev/null
adb wait-for-device
adb shell svc wifi disable
adb shell svc data disable
adb shell ip link set eth0 down

if adb shell ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
  echo 'The emulator still has network access.' >&2
  exit 1
fi

adb install "$apk"

if adb shell dumpsys package com.kjetilvalle.trene | grep -q 'DEBUGGABLE'; then
  echo 'The qualification APK must not be debuggable.' >&2
  exit 1
fi

npm run qualify:android
