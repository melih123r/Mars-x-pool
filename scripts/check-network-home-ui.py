#!/usr/bin/env python3
from pathlib import Path

source = Path("android/app/src/main/java/com/marsx/pool/NetworkHomeActivity.java").read_text(encoding="utf-8")

required = [
    "Açık rıza: VERİLMEDİ",
    "Rızayı iptal et",
    "ÇEVRİMDIŞI TEST",
    "Foreground service: KAPALI",
    "Bekleyen fiat:",
    "Kesinleşmiş fiat:",
    "Çekilebilir fiat:",
    "NONCUSTODIAL USDC CÜZDANI",
    "Solana: PARTNER BEKLENİYOR",
    "Base: PARTNER BEKLENİYOR",
    "Polygon: PARTNER BEKLENİYOR",
    "Net teklif: Kullanılamıyor",
    "Para çek • TEST / DEVRE DIŞI",
    "ÇEKİM GEÇMİŞİ",
    "AYARLAR",
    "1.000 kullanıcı pilotu",
    "10.000+ ölçek hedefi",
]
missing = [value for value in required if value not in source]
if missing:
    raise SystemExit("Network UI contract missing: " + ", ".join(missing))

if source.count("setEnabled(false)") < 2:
    raise SystemExit("Network and withdrawal controls must fail closed")
for forbidden in ("startForegroundService(", "sendTransaction(", "withdrawUsdc(", "Proxy.start("):
    if forbidden in source:
        raise SystemExit("Unsafe live action in Network test UI: " + forbidden)

print("Network UI contract: PASS")
