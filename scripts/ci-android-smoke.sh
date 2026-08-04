#!/usr/bin/env bash

set -euo pipefail

mkdir -p .artifacts

cleanup() {
  adb logcat -d > .artifacts/logcat.txt 2>&1 || true
  if [[ -d .artifacts/maestro/debug/.maestro ]]; then
    cp -R .artifacts/maestro/debug/.maestro .artifacts/maestro/debug/maestro || true
  fi
  if [[ -n "${metro_pid:-}" ]]; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# A clean checkout has no android/ directory. Expo generates it from app.json
# before Gradle builds and installs the debug app on the running emulator.
npx expo run:android --no-bundler

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
