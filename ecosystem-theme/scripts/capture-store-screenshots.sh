#!/usr/bin/env bash
set -euo pipefail

apk_path="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
output_dir="${2:-store-screenshots}"

test -s "$apk_path"
mkdir -p "$output_dir"

adb install -r "$apk_path"
adb shell settings put global stay_on_while_plugged_in 3
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb shell input keyevent 82
adb shell am force-stop com.marsx.pool
adb shell am start -W -n com.marsx.pool/.MainActivity

sleep 2
adb exec-out screencap -p > "$output_dir/00-launch.png"
adb shell uiautomator dump /sdcard/marsx-window.xml >/dev/null
adb shell cat /sdcard/marsx-window.xml > "$output_dir/window.xml"
if ! grep -q "MARS-X POOL" "$output_dir/window.xml"; then
  adb logcat -d > "$output_dir/logcat.txt"
  echo "MARS-X activity was not visible after launch" >&2
  exit 1
fi

screen_size="$(adb shell wm size | sed -n 's/.*Physical size: //p' | tail -n 1 | tr -d '\r')"
case "$screen_size" in
  *x*) ;;
  *) echo "Could not determine emulator screen size" >&2; exit 1 ;;
esac

screen_width="${screen_size%x*}"
screen_height="${screen_size#*x}"
tab_y="$((screen_height * 94 / 100))"

capture() {
  local file_name="$1"
  adb exec-out screencap -p > "$output_dir/$file_name"
  test -s "$output_dir/$file_name"
}

# These are authentic screens rendered by the current Android build. No UI
# mockups or post-processing are used.
capture "01-home.png"

adb shell input tap "$((screen_width / 2))" "$tab_y"
sleep 1
capture "02-sandbox.png"

adb shell input tap "$((screen_width * 5 / 6))" "$tab_y"
sleep 1
capture "03-account-and-privacy.png"

home_hash="$(sha256sum "$output_dir/01-home.png" | cut -d ' ' -f 1)"
sandbox_hash="$(sha256sum "$output_dir/02-sandbox.png" | cut -d ' ' -f 1)"
account_hash="$(sha256sum "$output_dir/03-account-and-privacy.png" | cut -d ' ' -f 1)"
if [ "$home_hash" = "$sandbox_hash" ] || [ "$sandbox_hash" = "$account_hash" ]; then
  echo "Screenshot capture did not change between app tabs" >&2
  exit 1
fi
