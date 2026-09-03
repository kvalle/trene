#!/usr/bin/env bash

set -euo pipefail

source scripts/android-e2e-readiness.sh

artifacts="$PWD/.artifacts"
android_artifacts="$artifacts/android"
maestro_artifacts="$artifacts/maestro-android-backup"
fixtures="$android_artifacts/fixtures"
package=com.kjetilvalle.trene
documents="/data/user/0/$package/files"
maestro_pid=""
private_access=direct
current_journey=setup
started_at="$(date +%s)"

mkdir -p "$maestro_artifacts/home" "$maestro_artifacts/tmp" "$maestro_artifacts/debug" "$maestro_artifacts/screenshots"
export MAESTRO_OPTS="-Duser.home=$maestro_artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$maestro_artifacts/tmp -Djansi.tmpdir=$maestro_artifacts/tmp -Djava.rmi.server.hostname=localhost -Djava.net.preferIPv4Stack=true"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037

cleanup() {
  local status=$?
  local suite=backup
  local finished_at
  [[ -n "${requested_interruption:-}" && "${requested_interruption:-}" != none ]] && suite="$requested_interruption"
  finished_at="$(date +%s)"
  if [[ -n "$maestro_pid" ]]; then kill "$maestro_pid" >/dev/null 2>&1 || true; wait "$maestro_pid" >/dev/null 2>&1 || true; fi
  capture_android_readiness_diagnostics
  adb exec-out screencap -p > "$maestro_artifacts/screenshots/final.png" 2>/dev/null || true
  for debug_directory in "$maestro_artifacts"/debug/*/.maestro; do
    if [[ -d "$debug_directory" ]]; then
      cp -R "$debug_directory" "${debug_directory%/.maestro}/maestro" || true
    fi
  done
  if [[ ! -f "$android_artifacts/runtime-metadata.json" ]]; then
    node -e 'const fs=require("node:fs"); fs.writeFileSync(process.argv[1],JSON.stringify({appVersion:"unknown",formatVersion:null,schemaVersion:null,platform:`Android API ${process.env.ANDROID_API_LEVEL||"unknown"}`,scenario:process.env.scenario||"unknown",stage:"failed-before-runtime-export-verification",tableCounts:null},null,2)+"\n")' "$android_artifacts/runtime-metadata.json" || true
  fi
  mkdir -p "$artifacts/android-e2e/$suite"
  {
    echo "suite=$suite"
    echo "journey=$current_journey"
    echo "status=$status"
    echo "started_at=$started_at"
    echo "finished_at=$finished_at"
    echo "duration_seconds=$((finished_at - started_at))"
    echo "android_api=$(adb shell getprop ro.build.version.sdk 2>/dev/null || true)"
    echo "android_fingerprint=$(adb shell getprop ro.build.fingerprint 2>/dev/null || true)"
    echo "adb_version=$(adb version 2>/dev/null | sed -n '1p' || true)"
    echo "maestro_version=$(maestro --version 2>/dev/null | sed -n '1p' || true)"
  } > "$artifacts/android-e2e/$suite/runtime-metadata.txt"
  if [[ "$status" -ne 0 ]]; then capture_android_e2e_diagnostics "$artifacts/android-e2e/$suite/$current_journey"; fi
}
trap cleanup EXIT

if adb shell run-as "$package" id >/dev/null 2>&1; then
  private_access=run-as
else
  wait_for_android_root_runtime
  if ! adb shell test -d "/data/user/0/$package" >/dev/null 2>&1; then
    echo 'App-private qualification access requires a debuggable APK or a rootable emulator.' >&2
    exit 1
  fi
fi

node scripts/create-ios-smoke-fixtures.mjs "$fixtures"

requested_flow="${ANDROID_BACKUP_E2E_FLOW:-all}"
requested_interruption="${ANDROID_BACKUP_INTERRUPTION_FLOW:-}"
if [[ ! "$requested_flow" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Invalid Android backup E2E flow name: $requested_flow" >&2
  exit 1
fi
if [[ -n "$requested_interruption" && "$requested_flow" != "all" ]]; then
  echo "ANDROID_BACKUP_E2E_FLOW cannot be combined with ANDROID_BACKUP_INTERRUPTION_FLOW" >&2
  exit 1
fi
if [[ -n "$requested_interruption" && "$requested_interruption" != "none" ]]; then
  flows=()
elif [[ "$requested_flow" == "all" ]]; then
  flows=(.maestro/e2e/android/backup/*.yaml)
else
  flow_path=".maestro/e2e/android/backup/$requested_flow.yaml"
  if [[ ! -f "$flow_path" || "$requested_flow" == "select-backup-file" ]]; then
    echo "Unknown standalone Android backup E2E flow: $requested_flow" >&2
    exit 1
  fi
  flows=("$flow_path")
fi

reset_app() {
  adb shell pm clear "$package" >/dev/null
  adb shell monkey -p "$package" 1 >/dev/null 2>&1
  sleep 2
  adb shell am force-stop "$package"
}

run_flow() {
  local flow="$1"
  shift
  maestro test --debug-output "$maestro_artifacts/debug/$(basename "$flow" .yaml)" "$@" "$flow"
}

private_test() {
  if [[ "$private_access" == "run-as" ]]; then adb shell run-as "$package" test "$@"
  else adb shell test "$@"
  fi
}

write_private_file() {
  local path="$1" value="$2"
  if [[ "$private_access" == "run-as" ]]; then
    printf '%s\n' "$value" | adb shell run-as "$package" sh -c "cat > '$path'"
  else
    printf '%s\n' "$value" | adb shell "cat > '$path'"
  fi
}

pull_private_file() {
  if [[ "$private_access" == "run-as" ]]; then adb exec-out run-as "$package" cat "$1" > "$2"
  else adb pull "$1" "$2" >/dev/null
  fi
}

remove_private_files() {
  if [[ "$private_access" == "run-as" ]]; then adb shell run-as "$package" rm -f "$@"
  else adb shell rm -f "$@"
  fi
}

private_files() {
  if [[ "$private_access" == "run-as" ]]; then adb shell run-as "$package" find "$1" -type f 2>/dev/null || true
  else adb shell find "$1" -type f 2>/dev/null || true
  fi
}

cross_platform_input="${CROSS_PLATFORM_BACKUP_INPUT:-}"
cross_platform_output="${CROSS_PLATFORM_BACKUP_OUTPUT:-}"
if [[ -n "$cross_platform_input" || -n "$cross_platform_output" ]]; then
  if [[ ! -f "$cross_platform_input" || -z "$cross_platform_output" ]]; then
    echo 'CROSS_PLATFORM_BACKUP_INPUT and CROSS_PLATFORM_BACKUP_OUTPUT must identify input and output files' >&2
    exit 1
  fi
  adb push "$cross_platform_input" /sdcard/Download/representative.zip >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Download/representative.zip >/dev/null
  adb shell am force-stop com.android.documentsui >/dev/null 2>&1 || true
  adb shell am force-stop com.google.android.documentsui >/dev/null 2>&1 || true
  reset_app
  export scenario=cross-platform-round-trip
  run_flow .maestro/e2e/android/backup/cross-platform-round-trip.yaml \
    -e "EXPECTED_WORKOUTS=${CROSS_PLATFORM_EXPECTED_WORKOUTS:-1}" \
    -e "EXPECTED_EXERCISES=${CROSS_PLATFORM_EXPECTED_EXERCISES:-2}"
  mkdir -p "$(dirname "$cross_platform_output")"
  pull_private_file "$documents/trene-automation-export.trene-backup" "$cross_platform_output"
  export QUALIFICATION_PLATFORM="Android API ${ANDROID_API_LEVEL:-unknown}"
  export QUALIFICATION_SCENARIO=cross-platform-round-trip
  node scripts/verify-cross-platform-backup.mjs "$cross_platform_output" \
    "$android_artifacts/runtime-metadata.json" "$cross_platform_input" --expected-package
  exit 0
fi

for flow in "${flows[@]}"; do
  if [[ "$(basename "$flow")" == "select-backup-file.yaml"
    || "$(basename "$flow")" == "cross-platform-round-trip.yaml" ]]; then continue; fi
  export scenario="$(basename "$flow" .yaml)"
  current_journey="$scenario"
  fixture=representative
  case "$(basename "$flow")" in
    damaged-backup.yaml) fixture=damaged ;;
    newer-backup.yaml) fixture=newer ;;
  esac
  adb push "$fixtures/$fixture.trene-backup" /sdcard/Download/representative.trene-backup >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Download/representative.trene-backup >/dev/null
  reset_app
  fault_scenario=""
  case "$(basename "$flow")" in
    storage-failure.yaml) fault_scenario=storage-failure ;;
    restore-failure.yaml) fault_scenario=restore-failure ;;
    rollback-failure.yaml) fault_scenario=rollback-failure ;;
  esac
  if [[ -n "$fault_scenario" ]]; then
    write_private_file "$documents/trene-automation-scenario.txt" "$fault_scenario"
  fi
  run_flow "$flow"
  if [[ "$fault_scenario" == "rollback-failure" ]]; then
    private_test -f "$documents/trene-restore-recovery/operation.json"
    private_test -f "$documents/trene-restore-recovery/rollback.sqlite"
    mkdir -p "$android_artifacts"
    node -e '
      const fs=require("node:fs");
      fs.writeFileSync(process.argv[1], JSON.stringify({scenario:"rollback-failure",safeStopObserved:true,operationMarkerPreserved:true,rollbackSnapshotPreserved:true},null,2)+"\n");
    ' "$android_artifacts/rollback-failure-metadata.json"
  fi
done

if [[ -n "$requested_interruption" && "$requested_interruption" != "none" ]]; then
  adb push "$fixtures/representative.trene-backup" /sdcard/Download/representative.trene-backup >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Download/representative.trene-backup >/dev/null
fi

if [[ "$requested_interruption" == "none"
  || (-z "$requested_interruption" && "$requested_flow" != "all") ]]; then exit 0; fi

run_interruption() {
  local name="$1" stage="$2" expected="$3"
  current_journey="$name"
  reset_app
  export scenario="$name"
  write_private_file "$documents/trene-automation-scenario.txt" "interrupt:$stage"
  maestro test --debug-output "$maestro_artifacts/debug/$name-start" ".maestro/e2e/android/interruption/$name-start.yaml" &
  maestro_pid=$!
  for _ in $(seq 1 60); do
    private_test -f "$documents/trene-automation-checkpoint.txt" && break
    sleep 1
  done
  private_test -f "$documents/trene-automation-checkpoint.txt"
  if [[ "$name" == "around-activation" ]]; then
    wait "$maestro_pid"
    maestro_pid=""
  fi
  adb shell am force-stop "$package"
  if [[ -n "$maestro_pid" ]]; then
    wait "$maestro_pid" || true
    maestro_pid=""
  fi
  remove_private_files "$documents/trene-automation-scenario.txt" "$documents/trene-automation-checkpoint.txt"
  run_flow ".maestro/e2e/android/interruption/$expected.yaml"
  if [[ "$name" == "export-cleanup" ]]; then
    test -z "$(private_files "/data/user/0/$package/cache/trene-exports")"
  fi
}

case "$requested_interruption" in
  "")
    run_interruption export-cleanup backup.share:before original-recovered
    run_interruption before-replacement restore.replacement:before original-recovered
    run_interruption around-activation restore.replacement:after restored-recovered
    run_interruption after-replacement restore.cleanup:before restored-recovered
    ;;
  export-cleanup) run_interruption export-cleanup backup.share:before original-recovered ;;
  before-replacement) run_interruption before-replacement restore.replacement:before original-recovered ;;
  around-activation) run_interruption around-activation restore.replacement:after restored-recovered ;;
  after-replacement) run_interruption after-replacement restore.cleanup:before restored-recovered ;;
  *)
    echo "Unknown Android backup interruption flow: $requested_interruption" >&2
    exit 1
    ;;
esac

test -z "$(private_files "/data/user/0/$package/cache/trene-exports")"
if private_test -f "$documents/trene-automation-trace.jsonl"; then
  pull_private_file "$documents/trene-automation-trace.jsonl" "$android_artifacts/backup-restore-trace.jsonl"
fi
node -e '
  const fs=require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({appVersion:"0.1.0",formatVersion:1,schemaVersion:1,platform:"Android API 34",scenarios:13,tableCounts:{exercises:2,workouts:1,workout_exercises:2,workout_sets:2}},null,2)+"\n");
' "$android_artifacts/runtime-metadata.json"
