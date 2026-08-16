#!/usr/bin/env bash

set -euo pipefail

artifacts="$PWD/.artifacts"
android_artifacts="$artifacts/android"
maestro_artifacts="$artifacts/maestro-android-backup"
fixtures="$android_artifacts/fixtures"
package=no.kvalle.trene
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
  if [[ -d "$maestro_artifacts/debug/.maestro" ]]; then
    cp -R "$maestro_artifacts/debug/.maestro" "$maestro_artifacts/debug/maestro" || true
  fi
  if [[ ! -f "$android_artifacts/runtime-metadata.json" ]]; then
    node -e 'const fs=require("node:fs"); fs.writeFileSync(process.argv[1],JSON.stringify({appVersion:"0.1.0",formatVersion:1,schemaVersion:1,platform:"Android API 34",scenario:process.env.scenario||"unknown"},null,2)+"\n")' "$android_artifacts/runtime-metadata.json" || true
  fi
}
trap cleanup EXIT

node scripts/create-ios-smoke-fixtures.mjs "$fixtures"
adb push "$fixtures"/*.trene-backup /sdcard/Download/ >/dev/null

reset_app() {
  adb shell pm clear "$package" >/dev/null
  adb shell monkey -p "$package" 1 >/dev/null 2>&1
  sleep 2
  adb shell am force-stop "$package"
  adb shell mkdir -p "$documents"
}

run_flow() {
  local flow="$1"
  maestro test --debug-output "$maestro_artifacts/debug/$(basename "$flow" .yaml)" "$flow"
}

for flow in .maestro/android-backup/*.yaml; do
  if [[ "$(basename "$flow")" == "select-backup-file.yaml" ]]; then continue; fi
  export scenario="$(basename "$flow" .yaml)"
  reset_app
  scenario=""
  case "$(basename "$flow")" in
    storage-failure.yaml) scenario=storage-failure ;;
    restore-failure.yaml) scenario=restore-failure ;;
    rollback-failure.yaml) scenario=rollback-failure ;;
  esac
  if [[ -n "$scenario" ]]; then
    printf '%s\n' "$scenario" | adb shell "cat > '$documents/trene-automation-scenario.txt'"
  fi
  run_flow "$flow"
done

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
    adb shell uiautomator dump /sdcard/trene-accessibility.xml >/dev/null
    adb pull /sdcard/trene-accessibility.xml "$android_artifacts/accessibility.xml" >/dev/null
    node -e '
      const xml=require("node:fs").readFileSync(process.argv[1],"utf8");
      if (!xml.includes("Gjenoppretter") || !xml.includes("enabled=\"false\"")) {
        throw new Error("Android accessibility tree did not expose the disabled destructive action");
      }
      const confirmation=xml.indexOf("Erstatt alle data?");
      const warning=xml.indexOf("Dette erstatter alle data i Trene og kan ikke angres.");
      const action=xml.indexOf("Gjenoppretter");
      if (!(confirmation >= 0 && confirmation < warning && warning < action)) {
        throw new Error("Android accessibility reading order is unsafe");
      }
    ' "$android_artifacts/accessibility.xml"
  fi
  adb shell am force-stop "$package"
  wait "$maestro_pid" || true
  maestro_pid=""
  adb shell rm -f "$documents/trene-automation-scenario.txt" "$documents/trene-automation-checkpoint.txt"
  run_flow ".maestro/android-interruption/$expected.yaml"
  if [[ "$name" == "export-cleanup" ]]; then
    test -z "$(adb shell find /data/user/0/$package/cache/trene-exports -type f 2>/dev/null || true)"
  fi
}

run_interruption export-cleanup backup.share:before original-recovered
run_interruption before-replacement restore.replacement:before original-recovered
run_interruption around-activation restore.replacement:after restored-recovered
run_interruption after-replacement restore.cleanup:before restored-recovered

test -z "$(adb shell find /data/user/0/$package/cache/trene-exports -type f 2>/dev/null || true)"
node -e '
  const fs=require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({appVersion:"0.1.0",formatVersion:1,schemaVersion:1,platform:"Android API 34",scenarios:13,tableCounts:{exercises:2,workouts:1,workout_exercises:2,workout_sets:2}},null,2)+"\n");
' "$android_artifacts/runtime-metadata.json"
