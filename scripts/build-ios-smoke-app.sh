#!/usr/bin/env bash

set -euo pipefail

artifacts="$PWD/.artifacts/ios"
derived_data="$artifacts/derived-data"
mkdir -p "$artifacts" "$PWD/.artifacts/expo"
export EXPO_PUBLIC_BACKUP_RESTORE_AUTOMATION=1
export __UNSAFE_EXPO_HOME_DIRECTORY="$PWD/.artifacts/expo"

npx expo prebuild --platform ios --no-install
pod install --project-directory=ios
xcodebuild \
  -workspace ios/Trene.xcworkspace \
  -scheme Trene \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO \
  build | tee "$artifacts/xcodebuild.log"

app="$derived_data/Build/Products/Release-iphonesimulator/Trene.app"
test -d "$app"
