#!/usr/bin/env python3
"""Static fail-closed checks for Network Android release inputs; no SDK secrets."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
gradle = (ROOT / "android/app/build.gradle").read_text()
manifest = (ROOT / "android/app/src/main/AndroidManifest.xml").read_text()
errors = []
for name, pattern in {
    "Android 8 minimum": r"\bminSdk\s+26\b",
    "application ID": r'applicationId\s+"com\.marsx\.pool"',
    "release minification": r"minifyEnabled\s+true",
}.items():
    if not re.search(pattern, gradle):
        errors.append(name)
if 'android:usesCleartextTraffic="false"' not in manifest:
    errors.append("cleartext disabled")
if 'android:allowBackup="false"' not in manifest:
    errors.append("backup disabled")
if not (ROOT / "android/app/src/main/res/xml/locales_config.xml").is_file():
    errors.append("locale config")
if errors:
    raise SystemExit("BLOCKED: " + ", ".join(errors))
print("PASS: Android 8, applicationId, release minification, transport, backup, locale config")
print("NOT VERIFIED: actual SDK linkage, consent, AdMob, signed AAB, Play Console, device tests")
