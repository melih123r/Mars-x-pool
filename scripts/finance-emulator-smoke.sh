#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-evidence
sdk="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
printf '%s\n' "$sdk" | tee qa-evidence/sdk.txt
test "$sdk" = "26"
adb shell getprop ro.product.cpu.abi | tee qa-evidence/abi.txt
adb shell cat /proc/meminfo | head -n 8 | tee qa-evidence/memory.txt
mem_kb="$(adb shell awk '/MemTotal:/ {print $2}' /proc/meminfo | tr -d '\r')"
test "$mem_kb" -ge 3000000
apk="$(find android/app/build/outputs/apk/debug -name '*.apk' -print -quit)"
test -n "$apk"
adb install -r "$apk"
adb shell monkey -p com.marsx.finance -c android.intent.category.LAUNCHER 1
sleep 12
adb shell dumpsys activity activities > qa-evidence/activities.txt
adb shell dumpsys meminfo com.marsx.finance > qa-evidence/app-memory.txt
adb logcat -d -t 4000 > qa-evidence/logcat.txt
adb shell screencap -p /sdcard/finance-start.png
adb pull /sdcard/finance-start.png qa-evidence/finance-start.png
if grep -E 'FATAL EXCEPTION|ANR in com.marsx.finance' qa-evidence/logcat.txt; then
  echo 'Finance crash/ANR detected'; exit 1
fi
adb shell pidof com.marsx.finance | tee qa-evidence/pid.txt
test -s qa-evidence/pid.txt
adb shell dumpsys window windows > qa-evidence/windows.txt
if grep -E 'Application Not Responding|isn.t responding|has stopped' qa-evidence/windows.txt; then
  echo 'System error dialog detected'; exit 1
fi
grep -q 'com.marsx.finance' qa-evidence/activities.txt
