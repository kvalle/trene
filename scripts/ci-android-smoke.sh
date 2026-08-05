#!/usr/bin/env bash

set -euo pipefail

apk="${ANDROID_SMOKE_APK:-.artifacts/android/app-debug.apk}"
bundle_url='http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=android&dev=true&lazy=true&minify=false&app=no.kvalle.trene&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server'

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

metro_started_at=$SECONDS
echo 'Starting Metro with an empty cache.'
npm run start:android > .artifacts/metro.log 2>&1 &
metro_pid=$!

for _ in {1..60}; do
  if curl --fail --silent http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    echo "Metro ready after $((SECONDS - metro_started_at))s. Prewarming the Android app bundle."
    prewarm_started_at=$SECONDS
    # Match Expo's native app entry so Maestro reuses this graph instead of
    # triggering a competing cold bundle during the first launch.
    curl --fail --silent --show-error --output /dev/null \
      "$bundle_url"
    prewarm_bundle_count=$(grep -c 'Android Bundled' .artifacts/metro.log || true)
    prewarm_modules=$(grep 'Android Bundled' .artifacts/metro.log \
      | grep -Eo '[0-9]+ modules' \
      | grep -Eo '[0-9]+')
    echo "Android app bundle ready after $((SECONDS - prewarm_started_at))s. Starting Maestro."
    npm run smoke:android
    full_bundle_count=$(grep -Fc "($prewarm_modules modules)" .artifacts/metro.log || true)
    bundle_count=$(grep -c 'Android Bundled' .artifacts/metro.log || true)
    if [[ "$full_bundle_count" -ne 1 || "$bundle_count" -le "$prewarm_bundle_count" ]]; then
      echo 'Expected one cold bundle followed by app requests to the same Metro server.' >&2
      exit 1
    fi
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
