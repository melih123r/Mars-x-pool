# MARS-X Network — Cross-platform contract (demo)

The Android application remains the only built mobile client. This directory defines
a portable, offline-first demo contract for future Windows, Linux, macOS, iOS and
web clients. It does not implement background traffic resale, a proxy, or payouts.

## Portable state machine
- IDLE: no monitoring; no network sharing.
- CONSENTED: user accepted an explicitly disclosed **demo-only** monitoring notice.
- MONITORING: foreground-only app traffic measurement, if internet is available.
- STOPPED: user revoked consent, lost internet, or battery safety threshold was hit.

Monitoring is permitted on Wi-Fi and cellular, subject to user choice and
metered-data warnings. Consent is per device and revocable. Never infer consent
for real network sharing from consent for this demo.

## Shared localization
English is the fallback. Translation dictionaries in `locales/` use stable keys.
Clients must fall back to English for missing keys. Do not display earnings as
real unless verified partner receipts exist. Currency formatting is locale-aware.

## Planned platform builds (not yet shipped)
- Android: Gradle APK/AAB (existing)
- Windows: signed MSIX/EXE
- Linux: AppImage/DEB
- macOS: signed and notarized DMG
- iOS: App Store IPA (subject to platform background-network restrictions)
- Web: PWA, browser-limited capabilities

Every new client must pass consent/revocation, offline, metered network,
accessibility, locale fallback and no-real-earnings tests before distribution.
