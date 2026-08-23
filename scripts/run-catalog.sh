#!/bin/sh
set -eu

usage() {
  cat <<'USAGE' >&2
Usage: sh scripts/run-catalog.sh --android | --ios [--clear] [--port <port>]

Starts Metro with the component catalog entrypoint and opens it directly in Expo Go.

Prerequisites:
  - Node >= 22.13 and npm dependencies installed
  - Expo Go on the target device/simulator (installed automatically when practical)
  - Android: running emulator or device visible via 'adb devices' and ADB reverse available
  - iOS: Xcode with an available simulator (xcrun simctl)

Examples:
  npm run catalog:android   # Android emulator/device via Expo Go
  npm run catalog:ios       # iOS simulator via Expo Go
USAGE
}

PLATFORM=""
EXPO_ARGS=""

for arg in "$@"; do
  case "$arg" in
    --android) PLATFORM="android" ;;
    --ios) PLATFORM="ios" ;;
    --help|-h) usage; exit 0 ;;
    --clear|--port) EXPO_ARGS="$EXPO_ARGS $arg" ;;
    *) 
      if echo "$EXPO_ARGS" | grep -q -- "--port"; then
        EXPO_ARGS="$EXPO_ARGS $arg"
      else
        echo "Unknown argument: $arg" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [ -z "$PLATFORM" ]; then
  echo "Missing required platform flag --android or --ios." >&2
  usage
  exit 1
fi

# Common Expo state isolation (same as scripts/start-android-metro.sh)
mkdir -p "$PWD/.artifacts/expo"
export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"
export REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
export EXPO_PUBLIC_COMPONENT_CATALOG=1

if [ "$PLATFORM" = "android" ]; then
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is required for --android. Install Android SDK platform-tools." >&2
    exit 1
  fi
  if ! adb devices | grep -q 'device$'; then
    echo 'No Android emulator or device is ready. Start one and run adb devices.' >&2
    exit 1
  fi
  adb reverse tcp:8081 tcp:8081
  # Propagate extra args like --clear or --port
  # shellcheck disable=SC2086
  exec expo start --lan --clear --android $EXPO_ARGS
else
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "xcrun is required for --ios. Install Xcode command line tools." >&2
    exit 1
  fi
  # shellcheck disable=SC2086
  exec expo start --clear --ios $EXPO_ARGS
fi
