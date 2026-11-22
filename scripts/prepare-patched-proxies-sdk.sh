#!/usr/bin/env bash
set -euo pipefail
# Build reviewed SDK patch from immutable commit; never use the unpatched binary.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${RUNNER_TEMP:-/tmp}/marsx-proxies-sdk-patched"
rm -rf "$SDK_DIR"
git clone --depth 1 --branch v1.3.2 https://github.com/bolivian-peru/android-peer-sdk.git "$SDK_DIR"
curl --fail --location --retry 3 --silent --show-error \
  https://raw.githubusercontent.com/melih123r/Mars-x-pool/57cc7369a1a829a979c0ef1528a9e7e0a81f4a3a/docs/network/proxies-sdk-v132-stop-race.patch \
  -o "$SDK_DIR/security.patch"
(
  cd "$SDK_DIR"
  git apply --check security.patch
  git apply security.patch
  chmod +x gradlew
  ./gradlew :sdk:assembleDebug --no-daemon
)
install -D "$SDK_DIR/sdk/build/outputs/aar/sdk-debug.aar" "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
test -s "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
sha256sum "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
