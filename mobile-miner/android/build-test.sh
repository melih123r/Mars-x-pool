#!/usr/bin/env bash
set -euo pipefail
: "${MINER_ANDROID_SDK:?Set MINER_ANDROID_SDK}"
: "${MINER_ECJ_JAR:?Set MINER_ECJ_JAR}"
MINER_ROOT=$(cd "$(dirname "$0")" && pwd)
MINER_BUILD="$MINER_ROOT/build"
MINER_TOOLS="$MINER_ANDROID_SDK/build-tools/36.0.0"
MINER_PLATFORM="$MINER_ANDROID_SDK/platforms/android-36/android.jar"
mkdir -p "$MINER_BUILD/classes" "$MINER_BUILD/dex"
java -jar "$MINER_ECJ_JAR" -1.8 -cp "$MINER_PLATFORM" -d "$MINER_BUILD/classes" \
  "$MINER_ROOT/src/com/marsx/mobileminer/"*.java
"$MINER_TOOLS/d8" --min-api 29 --lib "$MINER_PLATFORM" --output "$MINER_BUILD/dex" \
  "$MINER_BUILD/classes/com/marsx/mobileminer/"*.class
"$MINER_TOOLS/aapt" package -f -M "$MINER_ROOT/AndroidManifest.xml" \
  -S "$MINER_ROOT/res" -I "$MINER_PLATFORM" -F "$MINER_BUILD/base.apk"
cp "$MINER_BUILD/base.apk" "$MINER_BUILD/unsigned.apk"
(cd "$MINER_BUILD/dex" && "$MINER_TOOLS/aapt" add "$MINER_BUILD/unsigned.apk" classes.dex)
"$MINER_TOOLS/zipalign" -f 4 "$MINER_BUILD/unsigned.apk" "$MINER_BUILD/aligned.apk"
# This key identifies internal diagnostic builds only. Never use for public releases.
if [ ! -f "$MINER_BUILD/test.keystore" ]; then
  keytool -genkeypair -keystore "$MINER_BUILD/test.keystore" -storepass android \
    -keypass android -alias androiddebugkey -keyalg RSA -validity 365 \
    -dname "CN=MARS-X Internal Diagnostic" >/dev/null
fi
"$MINER_TOOLS/apksigner" sign --ks "$MINER_BUILD/test.keystore" --ks-pass pass:android \
  --out "$MINER_BUILD/MARS-X-Miner-Device-Test.apk" "$MINER_BUILD/aligned.apk"
"$MINER_TOOLS/apksigner" verify "$MINER_BUILD/MARS-X-Miner-Device-Test.apk"
"$MINER_TOOLS/aapt" dump badging "$MINER_BUILD/MARS-X-Miner-Device-Test.apk"
