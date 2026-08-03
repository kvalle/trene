#!/bin/sh

set -eu

if [ "${1:-}" = "--sandbox" ]; then
  artifacts="$PWD/.artifacts/maestro"
  mkdir -p "$artifacts/home" "$artifacts/tmp" "$artifacts/debug"

  export MAESTRO_OPTS="-Duser.home=$artifacts/home"
  export JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$artifacts/tmp -Djansi.tmpdir=$artifacts/tmp -Djava.rmi.server.hostname=localhost -Djava.net.preferIPv4Stack=true"
  export MAESTRO_CLI_NO_ANALYTICS=true
  export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
  export MAESTRO_DISABLE_UPDATE_CHECK=true
  export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
  debug_args="--debug-output $artifacts/debug"
else
  debug_args=""
fi

first=true
for flow in .maestro/smoke/*.yaml; do
  if [ "$first" = false ]; then
    # Let Android finish clearing the previous flow's app process and data.
    sleep 2
  fi
  # Separate invocations prevent clearState flows from racing on one emulator.
  maestro test $debug_args "$flow"
  first=false
done
