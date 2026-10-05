# MARS-X VRSC setup prototype

Version 0.3.0 is a separate Android 10+ setup and device-test application,
`com.marsx.mobileminer`. It does **not mine, exchange, sign, send or hold funds**.
No native engine is packaged. Internet permission is used only for an explicit Vipor TLS/protocol connection test. The Play application
`com.marsx.pool`, production backend and ViaBTC integration are not modified.

## Implemented

- Empty-by-default user payout address with VRSC R-address Base58Check validation.
  A checksum validates format, not ownership or whether an address is custodial.
- Validated worker name, LuckPool region selection and device-local settings.
  Explicit ownership acknowledgement is required before saving. Settings can be deleted.
- User-controlled device test, battery/thermal/network display and stop on backgrounding.
  The real mining Start button remains disabled because no engine is installed.
- Local conversion/withdrawal intent preview: exact decimal VRSC amount, target
  coin/network, destination and explicit unavailable quote/fee/balance status.
  Target choices are user intentions, **not supported exchange pairs**. Only VRSC
  destination checksums are validated; other network validation is outstanding.
  No quote, order, wallet handoff, transaction, ledger or payout endpoint is implemented.
- User-initiated Vipor TLS/subscription/authorization check, cancelled when leaving the activity or editing the wallet. No shares are submitted. The address is sent to Vipor, which also sees the network IP.
- Internal native process and verified TLS relay controllers are prepared but not wired to an enabled mining button; no engine binary is packaged.
- User-initiated links to Verus wallet/conversion guidance and LuckPool configuration.

No donation/default payout address, seed phrase, ViaBTC API key or admin credential
is included. Pool payouts are intended to go directly to each user's wallet.
Conversion after payout requires a distinct user-signed transaction.

## Remaining release gates

1. Build and audit an ARM64 VerusHash engine and its dependencies in an approved
   Android NDK environment. NDK 27.2.12479018 download was blocked by the current
   workspace network policy. No compiled engine has been obtained or verified.
   Candidate source inspected: `monkins1010/ccminer`, ARM branch,
   commit `1667394ad4120d64b0c57367e71cb832ad2e3645`, GPL-3.0. No binary is bundled.
2. Verify TLS support, pool protocol and real accepted shares. The upstream source
   inspected uses `stratum+tcp`; displaying CPU port 3960 is only a configuration
   preview. LuckPool advertises TLS port 3958, but engine compatibility is untested.
3. Integrate native lifecycle, one-thread limits, foreground notification, current
   telemetry enforcement, synchronous stop and no automatic restart. Battery readings are displayed from the platform broadcast, but initial sticky events do not refresh the safety timestamp. A non-sticky battery event must have arrived within five seconds. This is event freshness, not proof of hardware sensor freshness; real-device validation remains required.
4. Test on actual ARM64 devices: temperature, battery, backgrounding, process death,
   telemetry loss, network reconnection, address attribution and payout receipts.
5. Integrate a provider with **confirmed VRSC pair and network support**, live quotes,
   minimums/fees, expiry, slippage, refund policy and status reconciliation. Require
   destination validation, per-transaction review, wallet signature and idempotency.
   LTC, DOGE, BTC and USDT routes are not currently connected. Verus-native assets
   and native coins on another network must not be treated as interchangeable.
6. Verify license obligations, reproducible builds and production signing. Measure
   real economics before any earnings claim. Do not distribute this as a working miner.

The prototype policies use conservative experimental limits: user start/consent,
app visible, external power, battery >=80%, temperature <38 C, Android thermal
status below MODERATE, unmetered connection and ten-minute test sessions. They
are not certified hardware safety limits. The JavaScript reference additionally
requires a verified engine and notification; those are not implemented in the APK.

## Validation and build

```
node --test test/mobile-miner-safety.test.js
MINER_ECJ_JAR=/path/to/ecj.jar bash mobile-miner/android/test.sh
MINER_ANDROID_SDK=/path/to/sdk MINER_ECJ_JAR=/path/to/ecj.jar bash mobile-miner/android/build-test.sh
```

SDK platform and build-tools 36 are required. The APK uses an internal test key
and is not a production release. Tests cover policy logic, VRSC checksum/worker
validation and draft input handling; no Android device execution has been tested.

## Primary references checked 2026-10-04

- https://verus.io/mining — user-owned wallet and mobile/CPU mining guidance.
- https://luckpool.net/verus/connect.html — regional hosts, CPU/TLS ports, worker
  format; invalid addresses can fall back to another payout address upstream,
  which is why the app never supplies a default or accepts a bad checksum.
- https://verus.io/get-vrsc — wallet-based conversion of supported ecosystem assets;
  this does not establish a VRSC-to-LTC/DOGE route.
- https://github.com/monkins1010/ccminer/tree/ARM — candidate native source.

## Android native build work

`mobile-miner/native/build-android.sh` cross-compiles pinned source/dependencies with NDK 27.2.12479018. This is experimental and must pass CI, binary dependency checks and real-device tests before packaging or enabling mining. Its libcurl handles loopback Stratum only; the prepared Android relay verifies the pool certificate and hostname. No dependency or ELF check proves accepted shares or payment.
