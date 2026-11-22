#!/usr/bin/env python3
"""Fail-closed static checks for the Android Proxies.sx credential boundary."""
from pathlib import Path
import re

gradle = Path("android/app/build.gradle").read_text(encoding="utf-8")
partner = Path("android/app/src/main/java/com/marsx/pool/ProxiesSxPartner.java").read_text(encoding="utf-8")
activity = Path("android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text(encoding="utf-8")

# The current SDK accepts a string key, not a demonstrated scoped-device credential.
# Never allow a vendor master key to be hard-coded into the repository.
for path in [Path("android/app/build.gradle"), *Path("android/app/src/main").rglob("*.java")]:
    data = path.read_text(encoding="utf-8")
    if re.search(r"psx_[A-Za-z0-9_-]{16,}", data):
        raise SystemExit(f"Potential embedded Proxies.sx key in {path}")

for required in (
    'getOrElse("")',
    'buildConfigField "String", "PROXIES_SX_API_KEY"',
    'Patched Proxies.sx SDK AAR missing',
):
    if required not in gradle:
        raise SystemExit("Missing fail-closed SDK configuration: " + required)
if "BuildConfig.PROXIES_SX_API_KEY" not in activity:
    raise SystemExit("SDK credential path changed: review required")
if "isConfigured(BuildConfig.PROXIES_SX_API_KEY)" not in activity:
    raise SystemExit("Missing SDK-OFF default gate")
if "if (!isConfigured(apiKey))" not in partner:
    raise SystemExit("Missing invalid-credential rejection")
print("Proxies.sx static credential boundary: PASS (not physical-device verification)")
