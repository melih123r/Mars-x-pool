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
assert 'versionCode 19' in build and 'versionName "0.9.4-network-demo"' in build
assert 'NetworkStatusClient.fetch()' in source
assert 'proxyDisclosureAcknowledgement' in source
assert 'proxyStatusButton.setOnClickListener' in source
assert 'startDisabled.setEnabled(false)' in source
assert 'putBoolean("psx_read_notice_v1",false)' in source
assert 'putBoolean("consented",false)' in source
assert 'ProxiesPeerSDK' not in source
assert 'PROXIES_SX_API_KEY' not in source and 'apiKey' not in source
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
