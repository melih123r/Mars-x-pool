#!/usr/bin/env bash
set -euo pipefail

apk_path="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
output_dir="${2:-store-screenshots}"

test -s "$apk_path"
mkdir -p "$output_dir"

adb wait-for-device
for _ in $(seq 1 60); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 1
done
[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] || {
  echo "Android emulator did not finish booting" >&2
  exit 1
}

adb install -r "$apk_path"
adb shell settings put global stay_on_while_plugged_in 3
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard

{
  adb shell getprop ro.build.version.sdk
  adb shell cat /proc/meminfo | sed -n '1,5p'
} > "$output_dir/device-info.txt"
memory_kb="$(adb shell cat /proc/meminfo | awk '/MemTotal/{print $2}' | tr -d '\r')"
if [ -z "$memory_kb" ] || [ "$memory_kb" -lt 3400000 ]; then
  echo "Expected a 4 GB emulator profile, got MemTotal=${memory_kb:-unknown} kB" >&2
  exit 1
fi

screen_size="$(adb shell wm size | sed -n 's/.*Physical size: //p' | tail -n 1 | tr -d '\r')"
case "$screen_size" in
  *x*) ;;
  *) echo "Could not determine emulator screen size" >&2; exit 1 ;;
esac

screen_width="${screen_size%x*}"
screen_height="${screen_size#*x}"

adb shell am force-stop com.marsx.finance
adb shell am start -W -n com.marsx.finance/com.marsx.pool.FinanceActivity > "$output_dir/activity-start.txt"

sleep 4

assert_finance_visible() {
  local label="$1"
  adb shell uiautomator dump /sdcard/marsx-window.xml >/dev/null || true
  adb shell cat /sdcard/marsx-window.xml > "$output_dir/$label-window.xml" || true
  adb shell dumpsys window > "$output_dir/$label-focus.txt" || true

  if grep -Eiq "Application Not Responding|isn't responding|is not responding|aerr_application" \
      "$output_dir/$label-window.xml" "$output_dir/$label-focus.txt"; then
    adb exec-out screencap -p > "$output_dir/$label-blocked.png" || true
    adb logcat -d > "$output_dir/logcat.txt" || true
    echo "A system or application-not-responding dialog blocked $label" >&2
    exit 1
  fi

  if ! grep -q "MARS-X" "$output_dir/$label-window.xml" && \
      ! grep -q "com.marsx.finance" "$output_dir/$label-focus.txt"; then
    adb exec-out screencap -p > "$output_dir/$label-not-visible.png" || true
    adb logcat -d > "$output_dir/logcat.txt" || true
    echo "MARS-X activity was not visible during $label" >&2
    exit 1
  fi
}

assert_finance_visible "launch"
adb exec-out screencap -p > "$output_dir/00-launch.png"

theme_y="$((screen_height * 16 / 100))"
theme_x="$((screen_width * 52 / 100))"
scroll_start_y="$((screen_height * 82 / 100))"
scroll_end_y="$((screen_height * 32 / 100))"

capture() {
  local file_name="$1"
  assert_finance_visible "${file_name%.png}"
  adb exec-out screencap -p > "$output_dir/$file_name"
  test -s "$output_dir/$file_name"
}

# These are authentic screens rendered by the current Android build. No UI
# mockups or post-processing are used.
capture "01-finance-convert.png"

# Tap the center theme chip instead of the first chip, otherwise the second
# screenshot can remain visually identical to launch on fresh installs.
adb shell input tap "$theme_x" "$theme_y"
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
