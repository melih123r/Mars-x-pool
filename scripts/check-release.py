#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "android/app/src/main/AndroidManifest.xml"
GRADLE = ROOT / "android/app/build.gradle"
README = ROOT / "README.md"

required_files = [
    MANIFEST,
    GRADLE,
    ROOT / "android/app/src/main/res/xml/backup_rules.xml",
    ROOT / "android/app/src/main/res/xml/data_extraction_rules.xml",
    ROOT / "android/app/src/main/res/xml/locales_config.xml",
    ROOT / "PRIVACY.md",
    ROOT / "LICENSE",
    ROOT / "docs/PLAY-STORE-LISTING.md",
    ROOT / "docs/DATA-SAFETY-DRAFT.md",
    ROOT / "docs/CLOSED-BETA-RUNBOOK.md",
]

missing = [str(path.relative_to(ROOT)) for path in required_files if not path.is_file()]
if missing:
    raise SystemExit("Missing release files: " + ", ".join(missing))

manifest = MANIFEST.read_text(encoding="utf-8")
gradle = GRADLE.read_text(encoding="utf-8")
readme = README.read_text(encoding="utf-8")

for forbidden in (
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.REQUEST_INSTALL_PACKAGES",
):
    if forbidden in manifest:
        raise SystemExit(f"Forbidden beta permission present: {forbidden}")

if 'android.permission.INTERNET' not in manifest:
    raise SystemExit("INTERNET permission is required")
if not re.search(r"targetSdk\s+36", gradle):
    raise SystemExit("targetSdk 36 is required")
if "USDT_TEST" not in readme or "does **not** mine cryptocurrency on the Android device" not in readme:
    raise SystemExit("README must keep the sandbox and no-device-mining disclosures")

for folder in ("values", "values-tr", "values-id", "values-ar"):
    text = (ROOT / f"android/app/src/main/res/{folder}/strings.xml").read_text(encoding="utf-8")
    if "USDT_TEST" not in text:
        raise SystemExit(f"{folder} must disclose USDT_TEST")

print("Release policy checks OK")
