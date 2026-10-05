#!/usr/bin/env bash
set -euo pipefail
: "${MINER_ANDROID_SDK:?Set MINER_ANDROID_SDK}"

MINER_ROOT=$(cd "$(dirname "$0")" && pwd)
MINER_BUILD="$MINER_ROOT/build"
MINER_TOOLS="$MINER_ANDROID_SDK/build-tools/36.0.0"
MINER_PLATFORM="$MINER_ANDROID_SDK/platforms/android-36/android.jar"
mkdir -p "$MINER_BUILD/classes" "$MINER_BUILD/dex" "$MINER_BUILD/generated" "$MINER_BUILD/assets"
if [ -n "${MINER_ENGINE_DIR:-}" ]; then
  python3 "$MINER_ROOT/verify-engine-package.py" "$MINER_ENGINE_DIR" "$MINER_ROOT"
  mkdir -p "$MINER_BUILD/package/lib/arm64-v8a"
  cp "$MINER_ENGINE_DIR/libmarsxminer.so" "$MINER_ENGINE_DIR/libc++_shared.so" "$MINER_BUILD/package/lib/arm64-v8a/"
  cp "$MINER_ENGINE_DIR/ENGINE-LICENSE.txt" "$MINER_BUILD/assets/ENGINE-LICENSE.txt"
  cp "$MINER_ENGINE_DIR/PROVENANCE.txt" "$MINER_BUILD/assets/ENGINE-PROVENANCE.txt"
  cp "$MINER_ROOT/NATIVE-SOURCES.txt" "$MINER_BUILD/assets/NATIVE-SOURCES.txt"
fi
"$MINER_TOOLS/aapt" package -f -m -M "$MINER_ROOT/AndroidManifest.xml" -S "$MINER_ROOT/res" -I "$MINER_PLATFORM" -J "$MINER_BUILD/generated"
if [ -n "${MINER_ECJ_JAR:-}" ]; then
  java -jar "$MINER_ECJ_JAR" -1.8 -cp "$MINER_PLATFORM" -d "$MINER_BUILD/classes" \
    "$MINER_ROOT/src/com/marsx/mobileminer/"*.java "$MINER_BUILD/generated/com/marsx/mobileminer/R.java"
else
  javac -source 8 -target 8 -cp "$MINER_PLATFORM" -d "$MINER_BUILD/classes" \
    "$MINER_ROOT/src/com/marsx/mobileminer/"*.java "$MINER_BUILD/generated/com/marsx/mobileminer/R.java"
fi
"$MINER_TOOLS/d8" --min-api 29 --lib "$MINER_PLATFORM" --output "$MINER_BUILD/dex" \
  "$MINER_BUILD/classes/com/marsx/mobileminer/"*.class
"$MINER_TOOLS/aapt" package -f -M "$MINER_ROOT/AndroidManifest.xml" \
  -S "$MINER_ROOT/res" -A "$MINER_BUILD/assets" -I "$MINER_PLATFORM" -F "$MINER_BUILD/base.apk"
cp "$MINER_BUILD/base.apk" "$MINER_BUILD/unsigned.apk"
(cd "$MINER_BUILD/dex" && "$MINER_TOOLS/aapt" add "$MINER_BUILD/unsigned.apk" classes.dex)
if [ -n "${MINER_ENGINE_DIR:-}" ]; then
  (cd "$MINER_BUILD/package" && "$MINER_TOOLS/aapt" add "$MINER_BUILD/unsigned.apk" lib/arm64-v8a/libmarsxminer.so lib/arm64-v8a/libc++_shared.so)
fi
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
