#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/app-debug.apk}"

mkdir -p .artifacts

cleanup() {
  adb logcat -d > .artifacts/logcat.txt 2>&1 || true
  timeout 15s adb shell dumpsys activity processes > .artifacts/activity-processes.txt 2>&1 || true
  timeout 15s adb shell dumpsys meminfo > .artifacts/meminfo.txt 2>&1 || true
  timeout 15s adb shell dumpsys window > .artifacts/window.txt 2>&1 || true
  df -h > .artifacts/runner-disk.txt 2>&1 || true
  free -h > .artifacts/runner-memory.txt 2>&1 || true
  if [[ -d .artifacts/maestro/debug/.maestro ]]; then
    cp -R .artifacts/maestro/debug/.maestro .artifacts/maestro/debug/maestro || true
  fi
  if [[ -n "${metro_pid:-}" ]]; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ ! -f "$apk" ]]; then
  echo "Android smoke APK not found: $apk" >&2
  exit 1
fi

adb install -r "$apk"

npm run start:android > .artifacts/metro.log 2>&1 &
metro_pid=$!

for _ in {1..60}; do
  if curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    # Keep the first cold bundle build out of Maestro's launch/accessibility polling.
    curl --fail --silent --show-error --output /dev/null \
      'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false'
    npm run smoke:android
    exit 0
  fi
  if ! kill -0 "$metro_pid" 2>/dev/null; then
    echo 'Metro stopped before it became ready.' >&2
    exit 1
  fi
  sleep 2
done

echo 'Metro did not become ready within 120 seconds.' >&2
exit 1
