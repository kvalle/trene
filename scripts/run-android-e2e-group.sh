#!/usr/bin/env bash

set -euo pipefail

source scripts/android-e2e-readiness.sh

group="${1:-}"
case "$group" in
  smoke|standalone) ;;
  *)
    echo "Unknown Android E2E group: $group" >&2
    exit 2
    ;;
esac

artifacts="$PWD/.artifacts/maestro/$group"
diagnostics="$PWD/.artifacts/android-e2e/$group"
current_journey=setup
started_at="$(date +%s)"
mkdir -p "$artifacts/home" "$artifacts/tmp" "$artifacts/debug"

cleanup() {
  local status=$?
  local finished_at
  finished_at="$(date +%s)"
  mkdir -p "$diagnostics"
  {
    echo "suite=$group"
    echo "journey=$current_journey"
    echo "status=$status"
    echo "started_at=$started_at"
    echo "finished_at=$finished_at"
    echo "duration_seconds=$((finished_at - started_at))"
    echo "android_api=$(adb shell getprop ro.build.version.sdk 2>/dev/null || true)"
    echo "android_fingerprint=$(adb shell getprop ro.build.fingerprint 2>/dev/null || true)"
    echo "adb_version=$(adb version 2>/dev/null | sed -n '1p' || true)"
    echo "maestro_version=$(maestro --version 2>/dev/null | sed -n '1p' || true)"
  } > "$diagnostics/runtime-metadata.txt"
  if [[ "$status" -ne 0 ]]; then capture_android_e2e_diagnostics "$diagnostics/$current_journey"; fi
}
trap cleanup EXIT

export MAESTRO_OPTS="-Duser.home=$artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$artifacts/tmp -Djansi.tmpdir=$artifacts/tmp -Djava.rmi.server.hostname=localhost -Djava.net.preferIPv4Stack=true"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037

if ! adb devices | grep -q 'device$'; then
  echo 'No Android emulator or device is ready. Start one and run adb devices.' >&2
  exit 1
fi

if [[ "$group" == "smoke" ]]; then
  adb reverse tcp:8081 tcp:8081
  if ! adb reverse --list | grep -q 'tcp:8081 tcp:8081'; then
    echo 'Could not configure the Android reverse tunnel for Metro on port 8081.' >&2
    exit 1
  fi
fi

first_flow=true
for flow in ".maestro/e2e/android/$group"/*.yaml; do
  current_journey="$(basename "$flow" .yaml)"
  adb shell pm clear com.kjetilvalle.trene >/dev/null
  sleep 2
  if [[ "$first_flow" == true ]]; then
    maestro test --debug-output "$artifacts/debug/$(basename "$flow" .yaml)" "$flow"
    first_flow=false
  else
    maestro test --no-reinstall-driver --debug-output "$artifacts/debug/$(basename "$flow" .yaml)" "$flow"
  fi
done
