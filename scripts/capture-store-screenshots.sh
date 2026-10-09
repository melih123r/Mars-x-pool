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
adb shell am force-stop com.marsx.finance
adb shell am start -W -n com.marsx.finance/com.marsx.pool.FinanceActivity

sleep 2
adb exec-out screencap -p > "$output_dir/00-launch.png"
adb shell uiautomator dump /sdcard/marsx-window.xml >/dev/null
adb shell cat /sdcard/marsx-window.xml > "$output_dir/window.xml"
if ! grep -q "MARS-X" "$output_dir/window.xml"; then
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
theme_y="$((screen_height * 16 / 100))"
scroll_start_y="$((screen_height * 82 / 100))"
scroll_end_y="$((screen_height * 32 / 100))"

capture() {
  local file_name="$1"
  adb exec-out screencap -p > "$output_dir/$file_name"
  test -s "$output_dir/$file_name"
}

# These are authentic screens rendered by the current Android build. No UI
# mockups or post-processing are used.
capture "01-finance-convert.png"

adb shell input tap "$((screen_width * 30 / 100))" "$theme_y"
sleep 2
capture "02-finance-theme.png"

adb shell input swipe "$((screen_width / 2))" "$scroll_start_y" "$((screen_width / 2))" "$scroll_end_y" 500
sleep 2
capture "03-finance-broker-market.png"

home_hash="$(sha256sum "$output_dir/01-finance-convert.png" | cut -d ' ' -f 1)"
theme_hash="$(sha256sum "$output_dir/02-finance-theme.png" | cut -d ' ' -f 1)"
broker_hash="$(sha256sum "$output_dir/03-finance-broker-market.png" | cut -d ' ' -f 1)"
if [ "$home_hash" = "$theme_hash" ] && [ "$theme_hash" = "$broker_hash" ]; then
  adb shell input swipe "$((screen_width / 2))" "$scroll_start_y" "$((screen_width / 2))" "$scroll_end_y" 650
  sleep 2
  capture "03-finance-broker-market.png"
  broker_hash="$(sha256sum "$output_dir/03-finance-broker-market.png" | cut -d ' ' -f 1)"
fi
if [ "$home_hash" = "$theme_hash" ] && [ "$theme_hash" = "$broker_hash" ]; then
  echo "All captured Finance screens are identical; verify app navigation and UI interactions" >&2
  exit 1
fi
