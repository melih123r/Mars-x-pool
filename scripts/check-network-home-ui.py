#!/usr/bin/env python3
from pathlib import Path

source = Path("android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text(encoding="utf-8")

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
    "ÇEKİM GEÇMİŞİ",
    "AYARLAR",
    "FrameLayout adSlot",
    "adSlot.setVisibility(View.GONE)",
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
missing = [value for value in required if value not in source]
if missing:
    raise SystemExit("Network UI contract missing: " + ", ".join(missing))

resources = Path("android/app/src/main/res/values/strings.xml").read_text(encoding="utf-8")
for marker in ("network_monitor_off", "Bağlantı izleme kapalı", "Gerçek paylaşım: KAPALI"):
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
