#!/usr/bin/env python3
"""Fail-closed static checks for the Android Proxies.sx credential boundary."""
from pathlib import Path
import re
import subprocess
import sys

gradle = Path("android/app/build.gradle").read_text(encoding="utf-8")
partner = Path("android/app/src/main/java/com/marsx/pool/ProxiesSxPartner.java").read_text(encoding="utf-8")
activity = Path("android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text(encoding="utf-8")

# The current SDK accepts a string key, not a demonstrated scoped-device credential.
# Never allow a vendor master key to be hard-coded into the repository.
for path in [Path("android/app/build.gradle"), *Path("android/app/src/main").rglob("*.java")]:
    data = path.read_text(encoding="utf-8")
    if re.search(r"[\\\"\x27]psx_[A-Za-z0-9_-]{16,}[\\\"\x27]", data):
        raise SystemExit(f"Potential embedded Proxies.sx key in {path}")

for required in (
    'getOrElse("")',
    'buildConfigField "String", "PROXIES_SX_API_KEY"',
    'Patched Proxies.sx SDK AAR missing',
    'Refusing to package Proxies.sx account key in Android (debug or release)',
    'def escapedProxiesSxApiKey = ""',
):
    if required not in gradle:
        raise SystemExit("Missing fail-closed SDK configuration: " + required)
if "releaseRequested" in gradle:
    raise SystemExit("Unsafe debug-key packaging loophole reintroduced")
if "if (proxiesSxApiKey)" not in gradle:
    raise SystemExit("Missing any-variant credential block")
provenance = Path("scripts/prepare-patched-proxies-sdk.sh").read_text(encoding="utf-8")
for required in (
    "73cd02434e02c4c73d839947dc9771e9b062da99",
    "ac3f1930f536c67dc96bd3dab078abeaa5e176fe",
    "git -C \"$SDK_DIR\" rev-parse HEAD",
    "git -C \"$SDK_DIR\" hash-object",
    "git apply --check security.patch",
):
    if required not in provenance:
        raise SystemExit("Missing pinned SDK source/patch integrity guard")

if "BuildConfig.PROXIES_SX_API_KEY" not in activity:
    raise SystemExit("SDK credential path changed: review required")
if "isConfigured(BuildConfig.PROXIES_SX_API_KEY)" not in activity:
    raise SystemExit("Missing SDK-OFF default gate")
for required in (
    "context.stopService(new Intent(context, PeerProxyService.class))",
    "sdk.stop();",
    "lastStatus = ProxiesPeerSDK.Status.STOPPED;",
):
    if required not in partner:
        raise SystemExit("Missing force-stop fallback: "+required)
if "if (!isConfigured(apiKey))" not in partner:
    raise SystemExit("Missing invalid-credential rejection")
subprocess.run([sys.executable, "scripts/test-proxies-credential-regex.py"], check=True)
print("Proxies.sx static credential boundary: PASS (not physical-device verification)")
