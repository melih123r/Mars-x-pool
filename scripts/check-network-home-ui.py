#!/usr/bin/env python3
from pathlib import Path

source = Path("android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text(encoding="utf-8")
translated = Path("android/app/src/main/res/values-tr/network_ui.xml").read_text(encoding="utf-8")

required = [
    "Açık rıza: VERİLMEDİ",
    "Rızayı iptal et",
    "TrafficStats.getUidRxBytes",
    "TrafficStats.getUidTxBytes",
    "Bekleyen fiat:",
    "Kesinleşmiş fiat:",
    "Çekilebilir fiat:",
    "Cüzdan adresi ekle",
    "usdc_address",
    "AYARLAR",
    "FrameLayout adSlot=new FrameLayout(this)",
    "demoBanner=new DemoBanner(this,adSlot,adStatus)",
    "Açık rıza • yalnızca TEST",
    "IP adresi",
    "veri kotanızı",
    "Test rızasını kaydet",
    "Test rızası gelecekteki gerçek ağ paylaşımı için geçerli değildir",
]
for hidden in ("card(\"3  •  NONCUSTODIAL USDC CÜZDANI\")", "card(\"6  •  REKLAM ALANI / TEST\")"):
    # Legacy commented code is ignored by stripping block comments below.
    import re
    active_source = re.sub(r"/\\*.*?\\*/", "", source, flags=re.S)
    if hidden in active_source:
        raise SystemExit("Legacy user-facing section must remain hidden: " + hidden)
missing = [value for value in required if value not in source + translated]
if missing:
    raise SystemExit("Network UI contract missing: " + ", ".join(missing))

resources = Path("android/app/src/main/res/values/strings.xml").read_text(encoding="utf-8")
for marker in ("network_monitor_off", "network_history_heading", "network_consent_button", "network_earnings_heading", "Real sharing: OFF"):
    if marker not in resources:
        raise SystemExit("Network safety label missing from Android resources: " + marker)
for banned in ("1.000 kullanıcı pilotu", "10.000+ ölçek hedefi"):
    if banned in source:
        raise SystemExit("Pilot scale banner must not be visible: " + banned)
if 'new AlertDialog.Builder(this)' not in source:
    raise SystemExit("Explicit disclosure dialog required before test consent")
if source.index('new AlertDialog.Builder(this)') > source.index('putBoolean("consented",true)'):
    raise SystemExit("Consent must follow disclosure dialog")
if source.count('putBoolean("consented",true)') != 1:
    raise SystemExit("Consent must be recorded in exactly one confirmed path")
if "startMonitor();" not in source or "stopMonitor();" not in source:
    raise SystemExit("Local monitoring must have explicit start and stop paths")
if "onStop()" not in source:
    raise SystemExit("Local monitoring must stop when activity is backgrounded")
for forbidden in ("MobileAds.initialize(", "loadAd(", "AdRequest.Builder(", "startForegroundService(", "sendTransaction(", "withdrawUsdc(", "Proxy.start("):
    if forbidden in source:
        raise SystemExit("Unsafe live action in Network test UI: " + forbidden)

contract = Path("docs/network-rewarded-ads-70-30.md").read_text(encoding="utf-8")
for marker in ("70% MARS-X / 30% user", "0%", "floor(net_cents * 30 / 100)", "written partner approval", "5% of requested gross withdrawal", "EUR 10.00"):
    if marker not in contract:
        raise SystemExit("Missing rewarded-ad settlement gate: " + marker)

# A checklist is necessary for real-device acceptance; it is not proof of a passed device test.
acceptance = Path("docs/network-partner-onboarding-checklist.md").read_text(encoding="utf-8")
for marker in ("Release acceptance", "latest artifact", "Revoke test consent", "legacy Pool"):
    if marker not in acceptance:
        raise SystemExit("Missing device acceptance requirement: " + marker)

import subprocess
import sys
result = subprocess.run([sys.executable, "scripts/network_rewarded_revenue.py"], capture_output=True, text=True)
if result.returncode:
    raise SystemExit("Rewarded revenue allocation tests failed: " + result.stdout + result.stderr)
print(result.stdout.strip())
ledger_test = subprocess.run([sys.executable, "scripts/network_settlement_demo.py"], capture_output=True, text=True)
if ledger_test.returncode:
    raise SystemExit("Offline settlement simulation failed: " + ledger_test.stdout + ledger_test.stderr)
print(ledger_test.stdout.strip())
sqlite_test = subprocess.run([sys.executable, "scripts/network_sqlite_integrity_demo.py"], capture_output=True, text=True)
if sqlite_test.returncode:
    raise SystemExit("SQLite integrity simulation failed: " + sqlite_test.stdout + sqlite_test.stderr)
print(sqlite_test.stdout.strip())
print("Network UI contract: PASS")
subprocess.run([sys.executable, "scripts/check-demo-ads.py"], check=True)
subprocess.run([sys.executable, "scripts/check-network-locale.py"], check=True)


# Proxies.sx preview is built on the exact v19 Network edition, not legacy v13.
import xml.etree.ElementTree as ET
build=Path("android/app/build.gradle").read_text(encoding="utf-8")
assert 'versionCode 19' in build and 'versionName "0.9.4-network-pilot"' in build
assert 'NetworkStatusClient.fetch()' in source
assert 'proxyDisclosureAcknowledgement' in source
assert 'proxyStatusButton.setOnClickListener' in source
assert 'proxyPilotStart.setOnClickListener' in source
assert 'proxyPilot.start(key,installId)' in source
assert 'proxyPilot.stop()' in source
assert 'putBoolean("psx_read_notice_v1",false)' in source
assert 'putBoolean("consented",false)' in source
assert 'PROXIES_SX_API_KEY' not in source and 'apiKey' not in source
assert 'android-peer-sdk:1.3.2' in build
pilot=Path("android/app/src/main/java/com/marsx/pool/ProxiesPilotController.java").read_text(encoding="utf-8")
for marker in ('ProxiesPeerSDK.init', 'sdk.start()', 'sdk.stop()', 'validFarmerKey', 'Settings.Secure.ANDROID_ID'):
    assert marker in pilot, marker
assert not re.search(r'psx_[0-9a-fA-F]{32}', source+pilot+build), 'Farmer key must never enter Android sources'
root=Path("android/app/src/main/res")
translations={
    "tr":"values-tr","en":"values-en","fr":"values-fr","de":"values-de",
    "es":"values-es","it":"values-it","pt-BR":"values-pt-rBR","ru":"values-ru",
    "ar":"values-ar","nl":"values-nl","pl":"values-pl","uk":"values-uk",
    "ro":"values-ro","el":"values-el","cs":"values-cs","hu":"values-hu",
    "sv":"values-sv","zh-CN":"values-zh-rCN","zh-TW":"values-zh-rTW",
    "ja":"values-ja","ko":"values-ko","hi":"values-hi","id":"values-id",
    "vi":"values-vi","th":"values-th","fa":"values-fa","bn":"values-bn",
    "ur":"values-ur","ms":"values-ms","fil":"values-fil",
}
keys={
    "psx_page_title","psx_risk_extra","psx_acknowledgement",
    "psx_off_status","psx_zero_earnings","psx_start_disabled",
    "psx_stop_revoke","psx_prerequisites","psx_check_backend",
    "psx_checking","psx_backend_available","psx_backend_unavailable"
}
for folder in ["values", *translations.values(), "values-in"]:
    path=root/folder/"proxies_readiness.xml"
    xml=ET.parse(path).getroot()
    found={s.attrib["name"] for s in xml.findall("string")}
    assert found==keys, (folder,sorted(keys-found),sorted(found-keys))
print("MARS-X v19 proxy readiness: fail-closed, 30 languages, default resources PASS")

pilot_keys={
    "network_pilot_disclaimer","psx_pilot_warning","psx_pilot_stopped",
    "psx_pilot_connecting","psx_pilot_connected","psx_pilot_error",
    "psx_pilot_key_hint","psx_pilot_key_notice","psx_pilot_start",
    "psx_pilot_consent_required","psx_pilot_key_invalid",
    "psx_pilot_confirm_title","psx_pilot_confirm_message",
    "psx_pilot_device_id","psx_pilot_notification_required"
}
for folder in ["values", *translations.values(), "values-in"]:
    path=root/folder/"proxies_pilot.xml"
    xml=ET.parse(path).getroot()
    found={s.attrib["name"] for s in xml.findall("string")}
    assert found==pilot_keys,(folder,sorted(pilot_keys-found),sorted(found-pilot_keys))
print("MARS-X v19 LIVE pilot SDK controls and 30-language resources: PASS")

diagnostic_keys={
    "psx_check_partner","psx_check_credential","psx_check_isolation",
    "psx_check_distribution","psx_check_verified","psx_check_unverified"
}
for folder in ["values", *translations.values(), "values-in"]:
    path=root/folder/"proxies_diagnostics.xml"
    xml=ET.parse(path).getroot()
    found={s.attrib["name"] for s in xml.findall("string")}
    assert found==diagnostic_keys, (folder,sorted(diagnostic_keys-found),sorted(found-diagnostic_keys))
assert "readinessChecklist(result)" in source
assert "requestGeneration != proxyStatusGeneration" in source
assert "proxyStatusGeneration++;" in source
client=Path("android/app/src/main/java/com/marsx/pool/NetworkStatusClient.java").read_text(encoding="utf-8")
for contract_marker in ('"sdk_credentials_issued"', '"supported_actions"', '"read_status"',
                        'setInstanceFollowRedirects(false)', 'allowed.length() != 1'):
    assert contract_marker in client, contract_marker
print("MARS-X v19 diagnostic gate translations & strict read-only client: PASS")

# Real telemetry is Proxies.sx GLOBAL public counts, never farmer account balance.
board_keys={
    "psx_live_scope","psx_live_refresh","psx_live_loading",
    "psx_live_unavailable","psx_live_initial","psx_live_total",
    "psx_live_online","psx_live_mobile","psx_live_residential",
    "psx_live_datacenter","psx_live_updated"
}
for folder in ["values", *translations.values(), "values-in"]:
    path=root/folder/"network_live_board.xml"
    xml=ET.parse(path).getroot()
    found={item.attrib["name"] for item in xml.findall("string")}
    assert found==board_keys,(folder,sorted(board_keys-found),sorted(found-board_keys))
assert "NetworkLiveBoardClient.fetch()" in source
assert "liveBoardButton.setOnClickListener" in source
live_client=Path("android/app/src/main/java/com/marsx/pool/NetworkLiveBoardClient.java").read_text(encoding="utf-8")
for marker in ("global_public_peer_board", '"account_specific"', '"source"', 'setInstanceFollowRedirects(false)'):
    assert marker in live_client, marker
print("MARS-X v19 GLOBAL live network data labels, 30 languages and client: PASS")

farmer_keys={
    "psx_farmer_scope","psx_farmer_sign_in_required","psx_farmer_sign_in",
    "psx_farmer_refresh","psx_farmer_unavailable","psx_farmer_verified",
    "psx_farmer_listed","psx_farmer_traffic","psx_farmer_earnings"
}
for folder in ["values", *translations.values(), "values-in"]:
    path=root/folder/"network_farmer_live.xml"
    xml=ET.parse(path).getroot()
    found={item.attrib["name"] for item in xml.findall("string")}
    assert found==farmer_keys,(folder,sorted(farmer_keys-found),sorted(found-farmer_keys))
assert "NetworkFarmerLiveClient.fetch(session,installId)" in source
assert "farmerLiveHandler.postDelayed(farmerLiveRefresh,60000)" in source
assert "startActivity(new Intent(this,MainActivity.class))" in source
farmer_client=Path("android/app/src/main/java/com/marsx/pool/NetworkFarmerLiveClient.java").read_text(encoding="utf-8")
for marker in ("farmer_account_private", '"account_specific"', '"Authorization"',
               '"X-Install-Id"', "setInstanceFollowRedirects(false)"):
    assert marker in farmer_client, marker
assert "psx_" not in farmer_client
print("MARS-X v19 PRIVATE farmer totals, MARS-X auth, 30 languages and auto-refresh: PASS")

# The public AGENT summary has no API-key requirement in provider docs.
# Never forward the farmer key to public/global statistics endpoints.
public_board=Path("android/supabase/network-live-board/index.ts").read_text(encoding="utf-8")
assert "/v1/peer/agents/stats/summary" in public_board
assert "/v1/peer/board" not in public_board
assert "PROXIES_SX_FARMER_API_KEY" not in public_board
assert '"X-API-Key"' not in public_board
print("MARS-X public AGENT stats use official read-only route with NO farmer key: PASS")
