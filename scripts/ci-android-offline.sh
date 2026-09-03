#!/usr/bin/env bash

set -euo pipefail

source scripts/android-e2e-readiness.sh

apk="${ANDROID_SMOKE_APK:-.artifacts/android/trene.apk}"
suite="${ANDROID_QUALIFICATION_SUITE:-all}"
started_at="$(date +%s)"

mkdir -p .artifacts

cleanup() {
  local status=$?
  local finished_at
  finished_at="$(date +%s)"
  capture_android_readiness_diagnostics
  adb shell ip link set eth0 up >/dev/null 2>&1 || true
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell svc data enable >/dev/null 2>&1 || true
  df -h > .artifacts/runner-disk.txt 2>&1 || true
  free -h > .artifacts/runner-memory.txt 2>&1 || true
  if [[ -d .artifacts/maestro/debug/.maestro ]]; then
    cp -R .artifacts/maestro/debug/.maestro .artifacts/maestro/debug/maestro || true
  fi
  mkdir -p ".artifacts/android-e2e/$suite"
  if [[ ! -f ".artifacts/android-e2e/$suite/runtime-metadata.txt" ]]; then
    {
      echo "suite=$suite"
      echo "status=$status"
      echo "started_at=$started_at"
      echo "finished_at=$finished_at"
      echo "duration_seconds=$((finished_at - started_at))"
      echo "android_api=$(adb shell getprop ro.build.version.sdk 2>/dev/null || true)"
      echo "android_fingerprint=$(adb shell getprop ro.build.fingerprint 2>/dev/null || true)"
      echo "adb_version=$(adb version 2>/dev/null | sed -n '1p' || true)"
      echo "maestro_version=$(maestro --version 2>/dev/null | sed -n '1p' || true)"
      echo "java_version=$(java -version 2>&1 | sed -n '1p' || true)"
      echo "node_version=$(node --version 2>/dev/null || true)"
    } > ".artifacts/android-e2e/$suite/runtime-metadata.txt"
  fi
  if [[ "$status" -ne 0 ]]; then
    capture_android_e2e_diagnostics ".artifacts/android-e2e/$suite/setup"
  fi
}
trap cleanup EXIT

if [[ ! -f "$apk" ]]; then
  echo "Standalone Android APK not found: $apk" >&2
  exit 1
fi

adb uninstall com.kjetilvalle.trene >/dev/null 2>&1 || true
wait_for_android_root_runtime
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
