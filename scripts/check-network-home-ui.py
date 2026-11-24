#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

root = Path(".")
source = (root/"android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text()
pilot = (root/"android/app/src/publicNetwork/java/com/marsx/pool/ProxiesPilotController.java").read_text()
client = (root/"android/app/src/main/java/com/marsx/pool/ProxiesAutomaticEnrollmentClient.java").read_text()
manifest = (root/"android/app/src/main/AndroidManifest.xml").read_text()
build = (root/"android/app/build.gradle").read_text()
edge = (root/"supabase/functions/marsx-peer-enroll/index.ts").read_text()
tr = (root/"android/app/src/main/res/values-tr/network_ui.xml").read_text()

for marker in (
    "Açık rıza: VERİLMEDİ", "Rızayı iptal et", "TrafficStats.getUidRxBytes",
    "TrafficStats.getUidTxBytes", "Cüzdan adresi ekle", "usdc_address",
    "FrameLayout adSlot=new FrameLayout(this)", "demoBanner=new DemoBanner",
):
    assert marker in source + tr, marker
assert source.count('putBoolean("consented",true)') == 1
assert "startMonitor();" in source and "stopMonitor();" in source
assert "onStop()" in source and "onDestroy()" in source
for forbidden in ("MobileAds.initialize(", "sendTransaction(", "withdrawUsdc("):
    assert forbidden not in source, forbidden

assert 'versionCode 19' in build
assert 'versionName "0.9.4-network-pilot"' in build
assert 'android-peer-sdk:v1.3.2' in build
# Public OAuth client ID must be built even without CI secret injection.
# Without it new users cannot sign in after the legacy beta UI is removed.
assert 'apps.googleusercontent.com' in build and '.getOrElse("' in build
assert 'GOOGLE_WEB_CLIENT_ID' in build
assert 'android:name=".NetworkHomeActivity"' in manifest
for legacy in (".MainActivity", ".NetworkWebsiteActivity", ".VrscPoolActivity", ".PremiumActivity"):
    assert legacy not in manifest, legacy

# No account-wide provider key or key entry UI is allowed on Android.
for forbidden in (
    "proxyPilotKey", "savedFarmerKey", "rememberFarmerKey", "forgetFarmerKey",
    "LOCAL_SDK_KEY", "ProxiesPeerSDK.init", "startActivity(new Intent(this,MainActivity.class))",
):
    assert forbidden not in source + pilot + client, forbidden
assert not re.search(r"psx_[0-9a-fA-F]{32}", source + pilot + client + build)
for marker in (
    "beginNetworkGoogleSignIn(false)", "NetworkAuthClient.requestNonce",
    "NetworkAuthClient.exchange", "BuildConfig.PRIVATE_PHONE",
    "ProxiesAutomaticEnrollmentClient.online", "cancelPilotStatusChecks()",
    "pilotStatusGeneration++", "generation!=pilotStatusGeneration",
):
    assert marker in source, marker
private = (root/"android/app/src/privatePilot/java/com/marsx/pool/ProxiesPilotController.java").read_text()
assert "sdk.start()" in private and "sdk.stop()" in private and "context.stopService" in private
assert "operator-key" not in pilot and "sdk.start()" not in pilot
assert "privatePilotImplementation files" in build
for marker in (
    "marsx-peer-enroll", "pilot_device_credential", "farmer_api_key_included",
    'setInstanceFollowRedirects(false)', '"Authorization"', '"X-Install-Id"',
):
    assert marker in client, marker
assert "PROXIES_SX_FARMER_API_KEY" not in source + pilot + client
for marker in (
    "PROXIES_SX_FARMER_API_KEY", "/v1/peer/my-devices",
    "android_pilot_enrollment_unavailable", "pilot_device_status",
    "marsx-pool-api/auth/me",
):
    assert marker in edge, marker
assert "/v1/peer/agents/register" not in edge
assert "apiKey: auth.providerKey" not in edge
assert 'body?.consent !== true' in edge
assert 'body?.proxies_notice !== true' in edge
assert '"register_after_explicit_consent"' in edge
assert '.put("action","register_after_explicit_consent")' in client
assert '.put("consent",true)' in client
assert '.put("proxies_notice",true)' in client
for forbidden_response in ("farmer_api_key: providerKey", "api_key: providerKey"):
    assert forbidden_response not in edge

translations = {
    "tr":"values-tr","en":"values-en","fr":"values-fr","de":"values-de",
    "es":"values-es","it":"values-it","pt-BR":"values-pt-rBR","ru":"values-ru",
    "ar":"values-ar","nl":"values-nl","pl":"values-pl","uk":"values-uk",
    "ro":"values-ro","el":"values-el","cs":"values-cs","hu":"values-hu",
    "sv":"values-sv","zh-CN":"values-zh-rCN","zh-TW":"values-zh-rTW",
    "ja":"values-ja","ko":"values-ko","hi":"values-hi","id":"values-id",
    "vi":"values-vi","th":"values-th","fa":"values-fa","bn":"values-bn",
    "ur":"values-ur","ms":"values-ms","fil":"values-fil",
}
auto_keys = {
    "psx_auto_provisioning", "psx_auto_enrolling", "psx_auto_auth_required",
    "psx_auto_auth_failed", "psx_auto_provider_waiting",
}
for folder in ["values", *translations.values(), "values-in"]:
    path = root/"android/app/src/main/res"/folder/"proxies_automatic.xml"
    found = {item.attrib["name"] for item in ET.parse(path).getroot().findall("string")}
    assert found == auto_keys, (folder, auto_keys-found, found-auto_keys)

for command in (
    [sys.executable, "scripts/check-demo-ads.py"],
    [sys.executable, "scripts/check-network-locale.py"],
    [sys.executable, "scripts/network_rewarded_revenue.py"],
    [sys.executable, "scripts/network_settlement_demo.py"],
    [sys.executable, "scripts/network_sqlite_integrity_demo.py"],
):
    subprocess.run(command, check=True)

print("MARS-X v19 automatic live enrollment, consent, 30 languages and no-key APK: PASS")
