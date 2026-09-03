#!/usr/bin/env bash

set -euo pipefail

artifacts="$PWD/.artifacts"
ios_artifacts="$artifacts/ios"
maestro_artifacts="$artifacts/maestro-ios"
fixtures="$ios_artifacts/fixtures"
default_app="$ios_artifacts/derived-data/Build/Products/Release-iphonesimulator/Trene.app"
app="${IOS_E2E_APP:-$default_app}"
mkdir -p "$maestro_artifacts/home" "$maestro_artifacts/tmp" "$maestro_artifacts/debug" "$maestro_artifacts/screenshots"

export MAESTRO_OPTS="-Duser.home=$maestro_artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$maestro_artifacts/tmp -Djansi.tmpdir=$maestro_artifacts/tmp"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true

source scripts/ios-e2e-readiness.sh

created_simulator=false
udid=""
cleanup() {
  if [[ -n "$udid" ]]; then
    capture_ios_readiness_diagnostics "$udid"
    xcrun simctl io "$udid" screenshot "$maestro_artifacts/screenshots/final.png" >/dev/null 2>&1 || true
  fi
  xcrun simctl list devices > "$ios_artifacts/simulator-devices.txt" 2>&1 || true
  for directory in "$maestro_artifacts"/debug/*/.maestro; do
    if [[ -d "$directory" ]]; then
      cp -R "$directory" "${directory%/.maestro}/maestro" || true
    fi
  done
  node -e 'const fs=require("node:fs"); const p=process.argv[1]; if (!fs.existsSync(p)) { const value={appVersion:"unknown",formatVersion:null,schemaVersion:null,platform:`iOS ${process.env.IOS_SIMULATOR_RUNTIME||"unknown"} Simulator`,scenario:process.env.scenario||"unknown",stage:"failed-before-runtime-export-verification",tableCounts:null}; fs.writeFileSync(p, JSON.stringify(value,null,2)+"\n"); }' "$ios_artifacts/runtime-metadata.json" || true
  if [[ "$created_simulator" == true ]]; then
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
    xcrun simctl delete "$udid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -n "${IOS_SIMULATOR_UDID:-}" ]]; then
  udid="$IOS_SIMULATOR_UDID"
else
  device_name="${IOS_SIMULATOR_DEVICE:-iPhone 16}"
  runtime_version="${IOS_SIMULATOR_RUNTIME:-26}"
  device_type="$(xcrun simctl list devicetypes -j | jq -er --arg name "$device_name" '.devicetypes[] | select(.name == $name) | .identifier')"
  runtime_details="$(xcrun simctl list runtimes available -j | jq -cer --arg version "$runtime_version" '[.runtimes[] | select(.platform == "iOS" and (.version == $version or (.version | startswith($version + "."))))] | sort_by(.version | split(".") | map(tonumber)) | last')"
  runtime="$(jq -r '.identifier' <<< "$runtime_details")"
  resolved_runtime_version="$(jq -r '.version' <<< "$runtime_details")"
  simulator_name="Trene iOS E2E ${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${IOS_E2E_SHARD:-focused}"
  udid="$(xcrun simctl create "$simulator_name" "$device_type" "$runtime")"
  created_simulator=true
fi

xcrun simctl list devices > "$ios_artifacts/simulator-devices.txt"
jq -n \
  --arg udid "$udid" \
  --arg device "${device_name:-provided by IOS_SIMULATOR_UDID}" \
  --arg runtime "${resolved_runtime_version:-provided by IOS_SIMULATOR_UDID}" \
  '{simulatorUdid:$udid,device:$device,runtime:$runtime}' > "$ios_artifacts/simulator-selection.json"
xcrun simctl boot "$udid" >/dev/null 2>&1 || true
wait_for_ios_runtime "$udid"
node scripts/create-ios-smoke-fixtures.mjs "$fixtures"

cross_platform_input="${CROSS_PLATFORM_BACKUP_INPUT:-}"
cross_platform_output="${CROSS_PLATFORM_BACKUP_OUTPUT:-}"
if [[ -n "$cross_platform_input" || -n "$cross_platform_output" ]]; then
  if [[ ! -f "$cross_platform_input" || -z "$cross_platform_output" ]]; then
    echo 'CROSS_PLATFORM_BACKUP_INPUT and CROSS_PLATFORM_BACKUP_OUTPUT must identify input and output files' >&2
    exit 1
  fi
  scenario=cross-platform-round-trip
  export scenario
  xcrun simctl uninstall "$udid" com.kjetilvalle.trene >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" com.kjetilvalle.trene >/dev/null
  sleep 2
  xcrun simctl terminate "$udid" com.kjetilvalle.trene >/dev/null 2>&1 || true
  container="$(xcrun simctl get_app_container "$udid" com.kjetilvalle.trene data)"
  cp "$cross_platform_input" "$container/Documents/representative.trene-backup"
  maestro --device "$udid" test --debug-output "$maestro_artifacts/debug/$scenario" \
    .maestro/e2e/ios/cross-platform-round-trip.yaml
  mkdir -p "$(dirname "$cross_platform_output")"
  cp "$container/Documents/trene-automation-export.trene-backup" "$cross_platform_output"
  export QUALIFICATION_PLATFORM="iOS ${IOS_SIMULATOR_RUNTIME:-unknown} Simulator"
  export QUALIFICATION_SCENARIO=cross-platform-round-trip
  node scripts/verify-cross-platform-backup.mjs "$cross_platform_output" \
    "$ios_artifacts/runtime-metadata.json" "$cross_platform_input" --expected-package
  exit 0
fi

requested_flows="${IOS_E2E_FLOWS:-${IOS_E2E_FLOW:-all}}"
if [[ "$requested_flows" == "all" ]]; then
  flows=(.maestro/e2e/ios/*.yaml)
else
  IFS=',' read -r -a requested_flow_names <<< "$requested_flows"
  flows=()
  for requested_flow in "${requested_flow_names[@]}"; do
    if [[ ! "$requested_flow" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "Invalid iOS E2E flow name: $requested_flow" >&2
      exit 1
    fi
    flow_path=".maestro/e2e/ios/$requested_flow.yaml"
    if [[ ! -f "$flow_path" || "$requested_flow" == "select-backup-file" ]]; then
      echo "Unknown standalone iOS E2E flow: $requested_flow" >&2
      exit 1
    fi
    flows+=("$flow_path")
  done
fi

for flow in "${flows[@]}"; do
  if [[ "$(basename "$flow")" == "select-backup-file.yaml"
    || "$(basename "$flow")" == "cross-platform-round-trip.yaml" ]]; then continue; fi
  scenario="$(basename "$flow" .yaml)"
  export scenario
  xcrun simctl uninstall "$udid" com.kjetilvalle.trene >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" com.kjetilvalle.trene >/dev/null
  sleep 2
  xcrun simctl terminate "$udid" com.kjetilvalle.trene >/dev/null 2>&1 || true
  container="$(xcrun simctl get_app_container "$udid" com.kjetilvalle.trene data)"
  cp "$fixtures"/*.trene-backup "$container/Documents/"
  fault_scenario=""
  case "$(basename "$flow")" in
    storage-failure.yaml) fault_scenario="storage-failure" ;;
    restore-failure.yaml) fault_scenario="restore-failure" ;;
    rollback-failure.yaml) fault_scenario="rollback-failure" ;;
  esac
  if [[ -n "$fault_scenario" ]]; then printf '%s\n' "$fault_scenario" > "$container/Documents/trene-automation-scenario.txt"; fi
  maestro --device "$udid" test --debug-output "$maestro_artifacts/debug/$(basename "$flow" .yaml)" "$flow"
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
