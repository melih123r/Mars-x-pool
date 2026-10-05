#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "android/app/src/main/AndroidManifest.xml"
GRADLE = ROOT / "android/app/build.gradle"
README = ROOT / "README.md"
PACKAGE = ROOT / "package.json"
MAIN_ACTIVITY = ROOT / "android/app/src/main/java/com/marsx/pool/MainActivity.java"

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
    ROOT / "docs/CLOUDFLARE-ZERO-COST-DEPLOYMENT.md",
    ROOT / "docs/SUPABASE-ZERO-COST-DEPLOYMENT.md",
    ROOT / "cloudflare/src/worker.js",
    ROOT / "cloudflare/migrations/0001_initial.sql",
    ROOT / "cloudflare/migrations/0002_google_auth_referrals.sql",
    ROOT / "cloudflare/wrangler.toml",
    ROOT / "supabase/functions/marsx-pool-api/index.ts",
    ROOT / "supabase/functions/marsx-pool-api/worker.js",
    ROOT / "supabase/functions/marsx-pool-api/conversion.js",
    ROOT / "supabase/functions/marsx-pool-api/postgres-d1.ts",
    ROOT / "supabase/migrations/20260928154000_marsx_pool_backend.sql",
    ROOT / "supabase/migrations/20260928155000_marsx_pool_security_indexes.sql",
]

missing = [str(path.relative_to(ROOT)) for path in required_files if not path.is_file()]
if missing:
    raise SystemExit("Missing release files: " + ", ".join(missing))

manifest = MANIFEST.read_text(encoding="utf-8")
gradle = GRADLE.read_text(encoding="utf-8")
readme = README.read_text(encoding="utf-8")
package = PACKAGE.read_text(encoding="utf-8")
main_activity = MAIN_ACTIVITY.read_text(encoding="utf-8")

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
if 'versionName "0.8.4-beta"' not in gradle or 'versionCode 12' not in gradle:
    raise SystemExit("Beta 0.8.4 Android version is required")
if '"version": "0.8.4"' not in package:
    raise SystemExit("Package version must match Beta 0.8.4")
if 'APP_VERSION = "0.8.4-beta"' not in main_activity:
    raise SystemExit("Android runtime version must match Beta 0.8.4")
# Backend APIs can be deployed independently of the unchanged Android beta.
# Pin each runtime explicitly instead of assuming all platforms share a release.
runtime_versions = {
    ROOT / "server.js": "0.9.0",
    ROOT / "cloudflare/src/worker.js": "0.8.4",
    ROOT / "supabase/functions/marsx-pool-api/worker.js": "0.8.5",
}
for runtime, version in runtime_versions.items():
    if f'const VERSION = "{version}"' not in runtime.read_text(encoding="utf-8"):
        raise SystemExit(f"Runtime version is stale: {runtime.relative_to(ROOT)}")
if "MARSX_API_BASE_URL" not in gradle:
    raise SystemExit("API build-time endpoint is required")
if "GOOGLE_WEB_CLIENT_ID" not in gradle:
    raise SystemExit("Google Credential Manager client ID build field is required")
if "USDT_TEST" not in readme or "does **not** mine cryptocurrency on the Android device" not in readme:
    raise SystemExit("README must keep the sandbox and no-device-mining disclosures")

for folder in (
    "values",
    "values-tr",
    "values-id",
    "values-ar",
    "values-hi",
    "values-bn",
    "values-ur",
    "values-vi",
):
    text = (ROOT / f"android/app/src/main/res/{folder}/strings.xml").read_text(encoding="utf-8")
    if "USDT_TEST" not in text:
        raise SystemExit(f"{folder} must disclose USDT_TEST")

print("Release policy checks OK")
