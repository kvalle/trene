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

if ! adb devices | grep -q 'device$'; then
  echo 'No Android emulator or device is ready. Start one and run adb devices.' >&2
  exit 1
fi

qualification_suite="${ANDROID_QUALIFICATION_SUITE:-all}"
case "$qualification_suite" in
  all|standalone|export-cleanup|before-replacement|around-activation|after-replacement) ;;
  *)
    echo "Unknown Android qualification suite: $qualification_suite" >&2
    exit 2
    ;;
esac

if [ "$qualification_suite" = all ] || [ "$qualification_suite" = standalone ]; then
  for flow in .maestro/smoke/*.yaml .maestro/qualification/*.yaml; do
    adb shell pm clear no.kvalle.trene >/dev/null
    sleep 2
    maestro test --debug-output "$artifacts/debug" "$flow"
  done
  ANDROID_BACKUP_INTERRUPTION_FLOW=none npm run smoke:android:backup
fi

if [ "$qualification_suite" = all ]; then
  for flow in export-cleanup before-replacement around-activation after-replacement; do
    ANDROID_BACKUP_INTERRUPTION_FLOW="$flow" npm run smoke:android:backup
  done
elif [ "$qualification_suite" != standalone ]; then
  ANDROID_BACKUP_INTERRUPTION_FLOW="$qualification_suite" npm run smoke:android:backup
fi
