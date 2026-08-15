#!/usr/bin/env bash

set -euo pipefail

artifacts="$PWD/.artifacts"
ios_artifacts="$artifacts/ios"
maestro_artifacts="$artifacts/maestro-ios"
fixtures="$ios_artifacts/fixtures"
default_app="$(cat "$ios_artifacts/app-path.txt")"
app="${IOS_SMOKE_APP:-$default_app}"
mkdir -p "$maestro_artifacts/home" "$maestro_artifacts/tmp" "$maestro_artifacts/debug" "$maestro_artifacts/screenshots"

export MAESTRO_OPTS="-Duser.home=$maestro_artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$maestro_artifacts/tmp -Djansi.tmpdir=$maestro_artifacts/tmp"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true

udid="${IOS_SIMULATOR_UDID:-$(xcrun simctl list devices available -j | jq -r '[.devices[][] | select(.name | startswith("iPhone"))][0].udid')}"
test -n "$udid"
xcrun simctl boot "$udid" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$udid" -b
node scripts/create-ios-smoke-fixtures.mjs "$fixtures"

cleanup() {
  xcrun simctl spawn "$udid" log show --last 20m --style compact \
    --predicate 'process == "Trene"' > "$ios_artifacts/simulator.log" 2>&1 || true
  xcrun simctl io "$udid" screenshot "$maestro_artifacts/screenshots/final.png" >/dev/null 2>&1 || true
  xcrun simctl list devices > "$ios_artifacts/simulator-devices.txt" 2>&1 || true
  for directory in "$maestro_artifacts"/debug/*/.maestro; do
    if [[ -d "$directory" ]]; then
      cp -R "$directory" "${directory%/.maestro}/maestro" || true
    fi
  done
  node -e 'const fs=require("node:fs"); const p=process.argv[1]; if (!fs.existsSync(p)) { const value={appVersion:"0.1.0",formatVersion:1,schemaVersion:1,platform:"iOS Simulator",scenario:process.env.scenario||"unknown"}; fs.writeFileSync(p, JSON.stringify(value,null,2)+"\n"); }' "$ios_artifacts/runtime-metadata.json" || true
}
trap cleanup EXIT

for flow in .maestro/ios/*.yaml; do
  export scenario="$(basename "$flow" .yaml)"
  xcrun simctl uninstall "$udid" no.kvalle.trene >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" no.kvalle.trene >/dev/null
  sleep 2
  xcrun simctl terminate "$udid" no.kvalle.trene >/dev/null 2>&1 || true
  container="$(xcrun simctl get_app_container "$udid" no.kvalle.trene data)"
  cp "$fixtures"/*.trene-backup "$container/Documents/"
  fault_scenario=""
  case "$(basename "$flow")" in
    storage-failure.yaml) fault_scenario="storage-failure" ;;
    restore-failure.yaml) fault_scenario="restore-failure" ;;
    rollback-failure.yaml) fault_scenario="rollback-failure" ;;
  esac
  if [[ -n "$fault_scenario" ]]; then printf '%s\n' "$fault_scenario" > "$container/Documents/trene-automation-scenario.txt"; fi
  maestro test --debug-output "$maestro_artifacts/debug/$(basename "$flow" .yaml)" "$flow"
  if [[ "$scenario" == "rollback-failure" ]]; then
    test -f "$container/Documents/trene-restore-recovery/operation.json"
    test -f "$container/Documents/trene-restore-recovery/rollback.sqlite"
    node -e '
      const fs=require("node:fs");
      const marker=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const safe={appVersion:"0.1.0",formatVersion:1,schemaVersion:marker.restored.schemaVersion,platform:"iOS Simulator",scenario:"rollback-failure",stage:marker.stage,tableCounts:marker.restored.tableCounts,previewCounts:marker.restored.previewCounts};
      fs.writeFileSync(process.argv[2],JSON.stringify(safe,null,2)+"\n");
    ' "$container/Documents/trene-restore-recovery/operation.json" "$ios_artifacts/runtime-metadata.json"
  fi
done
