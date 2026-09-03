#!/usr/bin/env bash

ios_readiness_artifacts="${IOS_READINESS_ARTIFACTS:-$PWD/.artifacts/ios/readiness}"
ios_readiness_attempts="${IOS_READINESS_ATTEMPTS:-12}"
ios_readiness_interval="${IOS_READINESS_INTERVAL_SECONDS:-5}"
ios_readiness_command_timeout="${IOS_READINESS_COMMAND_TIMEOUT_SECONDS:-30}"
ios_maestro_probe_timeout="${IOS_MAESTRO_PROBE_TIMEOUT_SECONDS:-$(( ${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000} / 1000 ))}"

run_bounded_ios_command_with_timeout() {
  local timeout="$1"
  shift
  python3 -c '
import os
import signal
import subprocess
import sys

try:
    process = subprocess.Popen(sys.argv[2:], start_new_session=True)
    process.wait(timeout=float(sys.argv[1]))
except subprocess.TimeoutExpired:
    os.killpg(process.pid, signal.SIGKILL)
    process.wait()
    sys.exit(124)
except FileNotFoundError:
    sys.exit(127)
sys.exit(process.returncode)
' "$timeout" "$@"
}

run_bounded_ios_command() {
  run_bounded_ios_command_with_timeout "$ios_readiness_command_timeout" "$@"
}

capture_ios_readiness_diagnostics() {
  local simulator_udid="$1"
  mkdir -p "$ios_readiness_artifacts"
  run_bounded_ios_command xcrun simctl list devices -j > "$ios_readiness_artifacts/simulator-devices.json" 2>&1 || true
  run_bounded_ios_command xcrun simctl listapps "$simulator_udid" > "$ios_readiness_artifacts/simulator-apps.txt" 2>&1 || true
  run_bounded_ios_command xcrun simctl spawn "$simulator_udid" launchctl print system > "$ios_readiness_artifacts/simulator-services.txt" 2>&1 || true
  run_bounded_ios_command xcrun simctl spawn "$simulator_udid" ps aux > "$ios_readiness_artifacts/simulator-processes.txt" 2>&1 || true
  run_bounded_ios_command xcrun simctl spawn "$simulator_udid" log show --last 20m --style compact \
    --predicate 'process == "Trene" OR process == "SpringBoard" OR process == "Files" OR process CONTAINS[c] "maestro" OR process CONTAINS[c] "xctrunner" OR subsystem CONTAINS[c] "DocumentManager"' \
    > "$ios_readiness_artifacts/platform.log" 2>&1 || true
  run_bounded_ios_command maestro --version > "$ios_readiness_artifacts/maestro-version.txt" 2>&1 || true
  run_bounded_ios_command maestro --device "$simulator_udid" hierarchy > "$ios_readiness_artifacts/maestro-hierarchy.txt" 2>&1 || true
  ps aux > "$ios_readiness_artifacts/runner-processes.txt" 2>&1 || true
  df -h > "$ios_readiness_artifacts/runner-disk.txt" 2>&1 || true
  vm_stat > "$ios_readiness_artifacts/runner-memory.txt" 2>&1 || true
}

ios_readiness_timeout() {
  local description="$1"
  local simulator_udid="$2"
  echo "Timed out waiting for $description after $ios_readiness_attempts attempts with ${ios_readiness_interval}s polling." >&2
  capture_ios_readiness_diagnostics "$simulator_udid"
  return 1
}

wait_for_ios_condition() {
  local description="$1"
  local simulator_udid="$2"
  shift 2
  local attempt
  for ((attempt = 1; attempt <= ios_readiness_attempts; attempt++)); do
    if "$@"; then return 0; fi
    if ((attempt < ios_readiness_attempts)); then sleep "$ios_readiness_interval"; fi
  done
  ios_readiness_timeout "$description" "$simulator_udid"
}

ios_simulator_booted() {
  local simulator_udid="$1"
  run_bounded_ios_command xcrun simctl bootstatus "$simulator_udid" -b >/dev/null 2>&1
}

ios_maestro_driver_ready() {
  local simulator_udid="$1"
  mkdir -p "$ios_readiness_artifacts"
  run_bounded_ios_command_with_timeout "$ios_maestro_probe_timeout" maestro --device "$simulator_udid" hierarchy \
    > "$ios_readiness_artifacts/maestro-driver-probe.txt" 2>&1
}

wait_for_ios_runtime() {
  local simulator_udid="$1"
  wait_for_ios_condition "iOS simulator boot and migration completion" "$simulator_udid" ios_simulator_booted "$simulator_udid"
  wait_for_ios_condition "Maestro driver readiness" "$simulator_udid" ios_maestro_driver_ready "$simulator_udid"
  capture_ios_readiness_diagnostics "$simulator_udid"
  echo "iOS simulator and Maestro driver ready."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  case "${1:-ready}" in
    ready)
      [[ -n "${2:-${IOS_SIMULATOR_UDID:-}}" ]] || { echo "A simulator UDID is required." >&2; exit 2; }
      wait_for_ios_runtime "${2:-$IOS_SIMULATOR_UDID}"
      ;;
    diagnostics)
      [[ -n "${2:-${IOS_SIMULATOR_UDID:-}}" ]] || { echo "A simulator UDID is required." >&2; exit 2; }
      capture_ios_readiness_diagnostics "${2:-$IOS_SIMULATOR_UDID}"
      ;;
    *) echo "Usage: $0 [ready|diagnostics] [simulator-udid]" >&2; exit 2 ;;
  esac
fi
