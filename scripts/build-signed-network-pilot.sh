#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${MARSX_UPLOAD_KEYSTORE_PATH:?Set the persistent signing keystore path}"
: "${MARSX_UPLOAD_STORE_PASSWORD:?Missing signing store password}"
: "${MARSX_UPLOAD_KEY_ALIAS:?Missing signing alias}"
: "${MARSX_UPLOAD_KEY_PASSWORD:?Missing signing key password}"
: "${MARSX_ANDROID_OAUTH_SHA1:?Set the SHA-1 registered for com.marsx.pool in Google Cloud}"

export MARSX_UPLOAD_KEYSTORE_PATH="$(realpath -e "$MARSX_UPLOAD_KEYSTORE_PATH")"
expected=$(printf '%s' "$MARSX_ANDROID_OAUTH_SHA1" | tr -d ':' | tr 'A-F' 'a-f')
[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Android OAuth SHA-1" >&2; exit 1; }
cert=$(keytool -exportcert -keystore "$MARSX_UPLOAD_KEYSTORE_PATH" -alias "$MARSX_UPLOAD_KEY_ALIAS" -storepass:env MARSX_UPLOAD_STORE_PASSWORD | sha1sum)
[[ "${cert%% *}" == "$expected" ]] || { echo "Signing certificate differs from configured Android OAuth SHA-1" >&2; exit 1; }

gradle -p android :app:assembleRelease --no-daemon
apk=android/app/build/outputs/apk/release/app-release.apk
report=$(apksigner verify --print-certs "$apk")
actual=$(awk '/^Signer #1 certificate SHA-1 digest:/ {print $NF}' <<< "$report")
[[ "$actual" == "$expected" ]] || { echo "APK certificate mismatch" >&2; exit 1; }
printf 'Verified signed pilot: %s\n' "$apk"
