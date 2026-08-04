#!/bin/sh

set -eu

if ! adb devices | grep -q 'device$'; then
  echo 'No Android emulator or device is ready. Start one and run adb devices.' >&2
  exit 1
fi

mkdir -p "$PWD/.artifacts/expo"
adb reverse tcp:8081 tcp:8081

export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"
export REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
exec expo start --lan --clear "$@"
