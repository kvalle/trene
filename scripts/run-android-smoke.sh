#!/bin/sh

set -eu

artifacts="$PWD/.artifacts/maestro"
mkdir -p "$artifacts/home" "$artifacts/tmp" "$artifacts/debug"

export MAESTRO_OPTS="-Duser.home=$artifacts/home"
export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$artifacts/tmp -Djansi.tmpdir=$artifacts/tmp -Djava.rmi.server.hostname=localhost -Djava.net.preferIPv4Stack=true"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
debug_args="--debug-output $artifacts/debug"

if ! adb devices | grep -q 'device$'; then
  echo 'No Android emulator or device is ready. Start one and run adb devices.' >&2
  exit 1
fi

adb reverse tcp:8081 tcp:8081

if ! adb reverse --list | grep -q 'tcp:8081 tcp:8081'; then
  echo 'Could not configure the Android reverse tunnel for Metro on port 8081.' >&2
  exit 1
fi

for flow in .maestro/smoke/*.yaml; do
  # Clear data before Maestro launches the app. Combining clearState and launchApp
  # can race Android's delayed task cleanup, which may kill the new app process.
  adb shell pm clear com.kjetilvalle.trene >/dev/null
  sleep 2
  # Separate invocations keep each flow's app lifecycle isolated.
  maestro test $debug_args "$flow"
done
