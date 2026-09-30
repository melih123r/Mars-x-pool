#!/usr/bin/env bash
set -euo pipefail

apk_path="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
output_dir="${2:-store-screenshots}"

test -s "$apk_path"
mkdir -p "$output_dir"

adb install -r "$apk_path"
adb shell am force-stop com.marsx.pool
adb shell am start -W -n com.marsx.pool/.MainActivity

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
sleep 2
capture "01-home.png"

adb shell input tap "$((screen_width / 2))" "$tab_y"
sleep 1
capture "02-sandbox.png"

adb shell input tap "$((screen_width * 5 / 6))" "$tab_y"
sleep 1
capture "03-account-and-privacy.png"

