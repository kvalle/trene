#!/usr/bin/env bash

android_readiness_artifacts="${ANDROID_READINESS_ARTIFACTS:-$PWD/.artifacts/android-readiness}"
android_readiness_attempts="${ANDROID_READINESS_ATTEMPTS:-30}"
android_readiness_interval="${ANDROID_READINESS_INTERVAL_SECONDS:-2}"
android_readiness_command_timeout="${ANDROID_READINESS_COMMAND_TIMEOUT_SECONDS:-10}"
android_original_display_size=""
android_original_display_density=""
android_original_font_scale=""

run_bounded_android_command() {
  python3 -c '
import subprocess
import sys
import os
import signal

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
' "$android_readiness_command_timeout" "$@"
}

capture_android_readiness_diagnostics() {
  mkdir -p "$android_readiness_artifacts"
  run_bounded_android_command adb version > "$android_readiness_artifacts/adb-version.txt" 2>&1 || true
  run_bounded_android_command adb devices -l > "$android_readiness_artifacts/adb-devices.txt" 2>&1 || true
  run_bounded_android_command adb get-state > "$android_readiness_artifacts/adb-state.txt" 2>&1 || true
  run_bounded_android_command adb get-serialno > "$android_readiness_artifacts/adb-serial.txt" 2>&1 || true
  {
    echo "sys.boot_completed=$(run_bounded_android_command adb shell getprop sys.boot_completed 2>/dev/null || true)"
    echo "dev.bootcomplete=$(run_bounded_android_command adb shell getprop dev.bootcomplete 2>/dev/null || true)"
    echo "init.svc.bootanim=$(run_bounded_android_command adb shell getprop init.svc.bootanim 2>/dev/null || true)"
    echo "identity=$(run_bounded_android_command adb shell id 2>/dev/null || true)"
  } > "$android_readiness_artifacts/boot-root.txt"
  {
    echo "serial=$(run_bounded_android_command adb get-serialno 2>/dev/null || true)"
    echo "model=$(run_bounded_android_command adb shell getprop ro.product.model 2>/dev/null || true)"
    echo "release=$(run_bounded_android_command adb shell getprop ro.build.version.release 2>/dev/null || true)"
    echo "api=$(run_bounded_android_command adb shell getprop ro.build.version.sdk 2>/dev/null || true)"
    echo "fingerprint=$(run_bounded_android_command adb shell getprop ro.build.fingerprint 2>/dev/null || true)"
    echo "abi=$(run_bounded_android_command adb shell getprop ro.product.cpu.abi 2>/dev/null || true)"
    echo "display_size=$(run_bounded_android_command adb shell wm size 2>/dev/null | tr '\n' ';' || true)"
    echo "display_density=$(run_bounded_android_command adb shell wm density 2>/dev/null | tr '\n' ';' || true)"
    echo "font_scale=$(run_bounded_android_command adb shell settings get system font_scale 2>/dev/null || true)"
  } > "$android_readiness_artifacts/runtime-identity.txt"
  run_bounded_android_command adb shell pm path android > "$android_readiness_artifacts/package-manager.txt" 2>&1 || true
  df -h > "$android_readiness_artifacts/runner-disk.txt" 2>&1 || true
  free -h > "$android_readiness_artifacts/runner-memory.txt" 2>&1 || true
}

configure_android_test_display() {
  android_original_display_size="$(run_bounded_android_command adb shell wm size 2>/dev/null || true)"
  android_original_display_density="$(run_bounded_android_command adb shell wm density 2>/dev/null || true)"
  android_original_font_scale="$(run_bounded_android_command adb shell settings get system font_scale 2>/dev/null || true)"
  run_bounded_android_command adb shell wm size 1080x1920
  run_bounded_android_command adb shell wm density 420
  run_bounded_android_command adb shell settings put system font_scale 1.0
}

restore_android_test_display() {
  if [[ -z "$android_original_display_size" ]]; then return; fi
  if [[ "$android_original_display_size" == *"Override size:"* ]]; then
    run_bounded_android_command adb shell wm size "${android_original_display_size##*Override size: }" || true
  else
    run_bounded_android_command adb shell wm size reset || true
  fi
  if [[ "$android_original_display_density" == *"Override density:"* ]]; then
    run_bounded_android_command adb shell wm density "${android_original_display_density##*Override density: }" || true
  else
    run_bounded_android_command adb shell wm density reset || true
  fi
  if [[ -n "$android_original_font_scale" && "$android_original_font_scale" != "null" ]]; then
    run_bounded_android_command adb shell settings put system font_scale "$android_original_font_scale" || true
  fi
}

capture_android_e2e_diagnostics() {
  local target="$1"
  mkdir -p "$target"
  capture_android_readiness_diagnostics
  run_bounded_android_command adb exec-out screencap -p > "$target/screenshot.png" 2>/dev/null || true
  run_bounded_android_command adb shell uiautomator dump /sdcard/window.xml > "$target/ui-dump.txt" 2>&1 || true
  run_bounded_android_command adb exec-out cat /sdcard/window.xml > "$target/ui-hierarchy.xml" 2>/dev/null || true
  run_bounded_android_command adb logcat -d > "$target/logcat.txt" 2>&1 || true
  run_bounded_android_command adb devices -l > "$target/adb-devices.txt" 2>&1 || true
  run_bounded_android_command adb get-state > "$target/adb-state.txt" 2>&1 || true
  run_bounded_android_command adb shell dumpsys window > "$target/window.txt" 2>&1 || true
  run_bounded_android_command adb shell dumpsys activity > "$target/activity.txt" 2>&1 || true
  run_bounded_android_command adb shell dumpsys meminfo com.kjetilvalle.trene > "$target/app-memory.txt" 2>&1 || true
  df -h > "$target/runner-disk.txt" 2>&1 || true
  free -h > "$target/runner-memory.txt" 2>&1 || true
}

android_readiness_timeout() {
  echo "Timed out waiting for $1 after $android_readiness_attempts attempts." >&2
  capture_android_readiness_diagnostics
  return 1
}

wait_for_android_condition() {
  local description="$1"
  shift
  local attempt
  for ((attempt = 1; attempt <= android_readiness_attempts; attempt++)); do
    if "$@"; then return 0; fi
    sleep "$android_readiness_interval"
  done
  android_readiness_timeout "$description"
}

android_adb_connected() {
  [[ "$(run_bounded_android_command adb get-state 2>/dev/null || true)" == "device" ]]
}

android_boot_completed() {
  [[ "$(run_bounded_android_command adb shell getprop sys.boot_completed 2>/dev/null || true)" == "1" ]]
}

android_root_identity() {
  [[ "$(run_bounded_android_command adb shell id -u 2>/dev/null || true)" == "0" ]]
}

android_stable_root_identity() {
  if android_root_identity; then
    android_root_samples=$((android_root_samples + 1))
  else
    android_root_samples=0
    run_bounded_android_command adb root >/dev/null 2>&1 || true
  fi
  [[ "$android_root_samples" -ge 2 ]]
}

android_package_manager_ready() {
  [[ "$(run_bounded_android_command adb shell pm path android 2>/dev/null || true)" == package:* ]]
}

wait_for_android_root_runtime() {
  wait_for_android_condition "ADB root command" run_bounded_android_command adb root >/dev/null
  wait_for_android_condition "ADB reconnect" android_adb_connected
  wait_for_android_condition "Android boot completion" android_boot_completed
  local android_root_samples=0
  wait_for_android_condition "stable root identity" android_stable_root_identity
  wait_for_android_condition "package-manager readiness" android_package_manager_ready
  capture_android_readiness_diagnostics
  echo "Android runtime ready with stable root access."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  case "${1:-ready}" in
    ready) wait_for_android_root_runtime ;;
    diagnostics) capture_android_readiness_diagnostics ;;
    *) echo "Usage: $0 [ready|diagnostics]" >&2; exit 2 ;;
  esac
fi
