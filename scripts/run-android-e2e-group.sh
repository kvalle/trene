#!/usr/bin/env bash

set -euo pipefail

group="${1:-}"
case "$group" in
  smoke|standalone) ;;
  *)
    echo "Unknown Android E2E group: $group" >&2
    exit 2
    ;;
esac

artifacts="$PWD/.artifacts/maestro/$group"
mkdir -p "$artifacts/home" "$artifacts/tmp" "$artifacts/debug"

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

for flow in ".maestro/e2e/android/$group"/*.yaml; do
  adb shell pm clear com.kjetilvalle.trene >/dev/null
  sleep 2
  maestro test --debug-output "$artifacts/debug/$(basename "$flow" .yaml)" "$flow"
done
