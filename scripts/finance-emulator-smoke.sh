#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-evidence
sdk="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
printf '%s\n' "$sdk" | tee qa-evidence/sdk.txt
test "$sdk" = "26"
adb shell getprop ro.product.cpu.abi | tee qa-evidence/abi.txt
adb shell cat /proc/meminfo | awk 'NR <= 8 {print}' | tee qa-evidence/memory.txt
mem_kb="$(adb shell cat /proc/meminfo | awk '/^MemTotal:/ {print $2}' | tr -d '\r')"
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
# Fail if screenshot capture silently produced an empty or corrupt image.
test "$(stat -c %s qa-evidence/finance-start.png)" -gt 5000
file qa-evidence/finance-start.png | tee qa-evidence/screenshot-format.txt
grep -q 'PNG image data' qa-evidence/screenshot-format.txt
sha256sum qa-evidence/finance-start.png > qa-evidence/screenshot-sha256.txt
# Capture the accessibility hierarchy to diagnose missing controls and blank screens.
# UIAutomator can be unavailable on some images; keep evidence collection non-blocking.
if timeout 30s adb shell uiautomator dump /sdcard/finance-hierarchy.xml > qa-evidence/uiautomator-status.txt 2>&1; then
  adb pull /sdcard/finance-hierarchy.xml qa-evidence/finance-hierarchy.xml || true
fi
if grep -E 'FATAL EXCEPTION.*com.marsx.finance|ANR in com.marsx.finance' qa-evidence/logcat.txt; then
  echo 'Finance crash/ANR detected'; exit 1
fi
adb shell pidof com.marsx.finance | tee qa-evidence/pid.txt
test -s qa-evidence/pid.txt
# Ensure Android's resumed foreground activity belongs to the Finance package.
adb shell dumpsys activity activities | grep -E 'mResumedActivity|ResumedActivity' > qa-evidence/resumed-activity.txt || true
if ! grep -q 'com.marsx.finance' qa-evidence/resumed-activity.txt; then
  echo 'Finance is not the resumed foreground activity'; cat qa-evidence/resumed-activity.txt; exit 1
fi
adb shell dumpsys window windows > qa-evidence/windows.txt
if grep -E 'Application Not Responding|isn.t responding|has stopped' qa-evidence/windows.txt; then
  echo 'System error dialog detected'; exit 1
fi
grep -q 'com.marsx.finance' qa-evidence/activities.txt
# Exercise a normal background/resume lifecycle, then verify the app survives.
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell monkey -p com.marsx.finance -c android.intent.category.LAUNCHER 1
sleep 5
adb shell pidof com.marsx.finance | tee qa-evidence/resume-pid.txt
test -s qa-evidence/resume-pid.txt
adb shell dumpsys activity activities | grep -E 'mResumedActivity|ResumedActivity' > qa-evidence/resume-activity.txt || true
grep -q 'com.marsx.finance' qa-evidence/resume-activity.txt
adb shell screencap -p /sdcard/finance-resume.png
adb pull /sdcard/finance-resume.png qa-evidence/finance-resume.png
test "$(stat -c %s qa-evidence/finance-resume.png)" -gt 5000
file qa-evidence/finance-resume.png | tee qa-evidence/resume-screenshot-format.txt
grep -q 'PNG image data' qa-evidence/resume-screenshot-format.txt
sha256sum qa-evidence/finance-resume.png > qa-evidence/resume-screenshot-sha256.txt
adb logcat -d -t 4000 > qa-evidence/resume-logcat.txt
if grep -E 'FATAL EXCEPTION.*com.marsx.finance|ANR in com.marsx.finance' qa-evidence/resume-logcat.txt; then
  echo 'Finance lifecycle crash/ANR detected'; exit 1
fi

# Publish a concise machine-readable result for CI review.
printf 'sdk=%s\npackage=com.marsx.finance\nlaunch=pass\nresume=pass\n' "$sdk" > qa-evidence/smoke-result.txt
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo '### MARS-X Finance Android 8 smoke test'
    echo '- API level: 26 (Android 8)'
    echo '- Package: com.marsx.finance'
    echo '- Install, launch, foreground, HOME/relaunch: PASS'
    echo '- Initial and resumed PNG screenshots: verified; SHA-256 recorded'
  } >> "$GITHUB_STEP_SUMMARY"
fi
