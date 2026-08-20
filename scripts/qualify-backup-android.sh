#!/usr/bin/env bash

set -euo pipefail

package=com.kjetilvalle.trene
artifacts="$PWD/.artifacts/backup-qualification"
apk="${ANDROID_SMOKE_APK:-}"
if [[ $# -ne 0 ]]; then
  echo 'Usage: npm run qualify:backup:android' >&2
  exit 2
fi

mkdir -p "$artifacts"
device_list="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
device_count="$(printf '%s\n' "$device_list" | awk 'NF { count += 1 } END { print count + 0 }')"
if [[ "$device_count" -ne 1 ]]; then
  echo "Expected exactly one ready Android device; found $device_count." >&2
  exit 1
fi
serial="$device_list"
export ANDROID_SERIAL="$serial"

model="$(adb shell getprop ro.product.model | tr -d '\r')"
os="Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
fingerprint="$(adb shell getprop ro.build.fingerprint | tr -d '\r')"
if [[ -z "$apk" || ! -f "$apk" ]]; then
  echo 'Set ANDROID_SMOKE_APK to the qualification APK that will be installed.' >&2
  exit 1
fi
apk_sha="$(shasum -a 256 "$apk" | cut -d ' ' -f 1)"
adb install -r "$apk" >/dev/null

node -e '
  const fs=require("node:fs");
  const out={device:process.argv[2],os:process.argv[3],buildFingerprint:process.argv[4],apkSha256:process.argv[5],capturedAt:new Date().toISOString()};
  fs.writeFileSync(process.argv[1],JSON.stringify(out,null,2)+"\n");
' "$artifacts/environment.json" "$model" "$os" "$fingerprint" "$apk_sha"

if ! adb shell pm path "$package" >/dev/null 2>&1; then
  echo "Trene is not installed on $model. Install the qualification APK before continuing." >&2
  exit 1
fi

echo "Physical Android qualification target: $model, $os"
echo "Safe environment evidence: $artifacts/environment.json"
echo
echo 'Create and load the deterministic large fixture:'
echo '  npm run qualify:backup:fixture'
echo '  adb push .artifacts/backup-qualification/fixture/large.trene-backup /sdcard/Download/large.trene-backup'
echo
echo 'Run the automated native suite first:'
echo '  ANDROID_BACKUP_INTERRUPTION_FLOW=none npm run smoke:android:backup'
echo
echo 'Then verify manually on this device:'
echo '  1. Create and cancel sharing; confirm no saved-success claim.'
echo '  2. Cancel file selection; restore the synthetic backup over different data.'
echo '  3. Enable TalkBack and verify labels, order, focus, disabled states, confirmation, success, and errors.'
echo '  4. Run each interruption flow and the rollback-failure flow, preserving only safe metadata.'
echo '  5. Run the large synthetic dataset measurements described in the qualification document.'
echo
echo 'The qualification record remains pending until measured values and signed results are entered.'
