#!/usr/bin/env bash
set -euo pipefail
# Deterministic safety gate: exact upstream v1.3.2 annotated-tag COMMIT,
# immutable reviewed patch Git blob, no fallback to unpatched JitPack.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${RUNNER_TEMP:-/tmp}/marsx-proxies-sdk-patched"
UPSTREAM_COMMIT="73cd02434e02c4c73d839947dc9771e9b062da99"
PATCH_BLOB_SHA1="ac3f1930f536c67dc96bd3dab078abeaa5e176fe"
PATCH_COMMIT="57cc7369a1a829a979c0ef1528a9e7e0a81f4a3a"
rm -rf "$SDK_DIR"
git clone --depth 1 --branch v1.3.2 \
  https://github.com/bolivian-peru/android-peer-sdk.git "$SDK_DIR"
if [[ "$(git -C "$SDK_DIR" rev-parse HEAD)" != "$UPSTREAM_COMMIT" ]]; then
  echo "Refusing altered Proxies.sx v1.3.2 tag" >&2
  exit 1
fi
curl --fail --location --retry 3 --silent --show-error \
  "https://raw.githubusercontent.com/melih123r/Mars-x-pool/$PATCH_COMMIT/docs/network/proxies-sdk-v132-stop-race.patch" \
  -o "$SDK_DIR/security.patch"
if [[ "$(git -C "$SDK_DIR" hash-object "$SDK_DIR/security.patch")" != "$PATCH_BLOB_SHA1" ]]; then
  echo "Refusing altered Proxies.sx SDK security patch" >&2
  exit 1
fi
(
  cd "$SDK_DIR"
  git apply --check security.patch
  git apply security.patch
  git diff --check
  chmod +x gradlew
  ./gradlew :sdk:assembleDebug --no-daemon
)
install -D "$SDK_DIR/sdk/build/outputs/aar/sdk-debug.aar" \
  "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
test -s "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
sha256sum "$ROOT/android/app/libs/proxies-sdk-v132-patched-debug.aar"
