#!/usr/bin/env bash

set -euo pipefail

group="${1:-all}"
case "$group" in
  all)
    npm run e2e:android:smoke
    npm run e2e:android:standalone
    ANDROID_BACKUP_INTERRUPTION_FLOW=none npm run e2e:android:backup
    ;;
  smoke|standalone)
    exec bash scripts/run-android-e2e-group.sh "$group"
    ;;
  backup)
    export ANDROID_BACKUP_INTERRUPTION_FLOW="${ANDROID_BACKUP_INTERRUPTION_FLOW:-none}"
    exec bash scripts/run-android-backup-e2e.sh
    ;;
  *)
    echo "Unknown Android E2E group: $group" >&2
    exit 2
    ;;
esac
