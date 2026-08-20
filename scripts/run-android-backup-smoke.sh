#!/usr/bin/env bash

set -euo pipefail

artifacts="$PWD/.artifacts"
android_artifacts="$artifacts/android"
maestro_artifacts="$artifacts/maestro-android-backup"
fixtures="$android_artifacts/fixtures"
package=com.kjetilvalle.trene
documents="/data/user/0/$package/files"
maestro_pid=""

mkdir -p "$maestro_artifacts/home" "$maestro_artifacts/tmp" "$maestro_artifacts/debug" "$maestro_artifacts/screenshots"
export MAESTRO_OPTS="-Duser.home=$maestro_artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$maestro_artifacts/tmp -Djansi.tmpdir=$maestro_artifacts/tmp -Djava.rmi.server.hostname=localhost -Djava.net.preferIPv4Stack=true"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037

cleanup() {
  if [[ -n "$maestro_pid" ]]; then kill "$maestro_pid" >/dev/null 2>&1 || true; wait "$maestro_pid" >/dev/null 2>&1 || true; fi
  adb exec-out screencap -p > "$maestro_artifacts/screenshots/final.png" 2>/dev/null || true
  for debug_directory in "$maestro_artifacts"/debug/*/.maestro; do
    if [[ -d "$debug_directory" ]]; then
      cp -R "$debug_directory" "${debug_directory%/.maestro}/maestro" || true
    fi
  done
  if [[ ! -f "$android_artifacts/runtime-metadata.json" ]]; then
    node -e 'const fs=require("node:fs"); fs.writeFileSync(process.argv[1],JSON.stringify({appVersion:"unknown",formatVersion:null,schemaVersion:null,platform:`Android API ${process.env.ANDROID_API_LEVEL||"unknown"}`,scenario:process.env.scenario||"unknown",stage:"failed-before-runtime-export-verification",tableCounts:null},null,2)+"\n")' "$android_artifacts/runtime-metadata.json" || true
  fi
}
trap cleanup EXIT

node scripts/create-ios-smoke-fixtures.mjs "$fixtures"

requested_flow="${ANDROID_BACKUP_SMOKE_FLOW:-all}"
requested_interruption="${ANDROID_BACKUP_INTERRUPTION_FLOW:-}"
if [[ ! "$requested_flow" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Invalid Android backup smoke flow name: $requested_flow" >&2
  exit 1
fi
if [[ -n "$requested_interruption" && "$requested_flow" != "all" ]]; then
  echo "ANDROID_BACKUP_SMOKE_FLOW cannot be combined with ANDROID_BACKUP_INTERRUPTION_FLOW" >&2
  exit 1
fi
if [[ -n "$requested_interruption" && "$requested_interruption" != "none" ]]; then
  flows=()
elif [[ "$requested_flow" == "all" ]]; then
  flows=(.maestro/android-backup/*.yaml)
else
  flow_path=".maestro/android-backup/$requested_flow.yaml"
  if [[ ! -f "$flow_path" || "$requested_flow" == "select-backup-file" ]]; then
    echo "Unknown standalone Android backup smoke flow: $requested_flow" >&2
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
  maestro test --debug-output "$maestro_artifacts/debug/$(basename "$flow" .yaml)" "$flow"
}

cross_platform_input="${CROSS_PLATFORM_BACKUP_INPUT:-}"
cross_platform_output="${CROSS_PLATFORM_BACKUP_OUTPUT:-}"
if [[ -n "$cross_platform_input" || -n "$cross_platform_output" ]]; then
  if [[ ! -f "$cross_platform_input" || -z "$cross_platform_output" ]]; then
    echo 'CROSS_PLATFORM_BACKUP_INPUT and CROSS_PLATFORM_BACKUP_OUTPUT must identify input and output files' >&2
    exit 1
  fi
  adb push "$cross_platform_input" /sdcard/Download/representative.trene-backup >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d file:///sdcard/Download/representative.trene-backup >/dev/null
  reset_app
  export scenario=cross-platform-round-trip
  run_flow .maestro/android-backup/cross-platform-round-trip.yaml
  mkdir -p "$(dirname "$cross_platform_output")"
  adb pull "$documents/trene-automation-export.trene-backup" "$cross_platform_output" >/dev/null
  export QUALIFICATION_PLATFORM="Android API ${ANDROID_API_LEVEL:-unknown}"
  export QUALIFICATION_SCENARIO=cross-platform-round-trip
  node scripts/verify-cross-platform-backup.mjs "$cross_platform_output" "$android_artifacts/runtime-metadata.json"
  exit 0
fi

for flow in "${flows[@]}"; do
  if [[ "$(basename "$flow")" == "select-backup-file.yaml"
    || "$(basename "$flow")" == "cross-platform-round-trip.yaml" ]]; then continue; fi
  export scenario="$(basename "$flow" .yaml)"
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
    printf '%s\n' "$fault_scenario" | adb shell "cat > '$documents/trene-automation-scenario.txt'"
  fi
  run_flow "$flow"
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
  reset_app
  export scenario="$name"
  printf 'interrupt:%s\n' "$stage" | adb shell "cat > '$documents/trene-automation-scenario.txt'"
  maestro test --debug-output "$maestro_artifacts/debug/$name-start" ".maestro/android-interruption/$name-start.yaml" &
  maestro_pid=$!
  for _ in $(seq 1 60); do
    adb shell test -f "$documents/trene-automation-checkpoint.txt" && break
    sleep 1
  done
  adb shell test -f "$documents/trene-automation-checkpoint.txt"
  if [[ "$name" == "around-activation" ]]; then
    wait "$maestro_pid"
    maestro_pid=""
  fi
  adb shell am force-stop "$package"
  if [[ -n "$maestro_pid" ]]; then
    wait "$maestro_pid" || true
    maestro_pid=""
  fi
  adb shell rm -f "$documents/trene-automation-scenario.txt" "$documents/trene-automation-checkpoint.txt"
  run_flow ".maestro/android-interruption/$expected.yaml"
  if [[ "$name" == "export-cleanup" ]]; then
    test -z "$(adb shell find /data/user/0/$package/cache/trene-exports -type f 2>/dev/null || true)"
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

test -z "$(adb shell find /data/user/0/$package/cache/trene-exports -type f 2>/dev/null || true)"
node -e '
  const fs=require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({appVersion:"0.1.0",formatVersion:1,schemaVersion:1,platform:"Android API 34",scenarios:13,tableCounts:{exercises:2,workouts:1,workout_exercises:2,workout_sets:2}},null,2)+"\n");
' "$android_artifacts/runtime-metadata.json"
