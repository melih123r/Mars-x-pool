# MARS-X experimental VRSC worker

Version 0.4.0 is a separate Android 10+ test application (`com.marsx.mobileminer`).
It can request a one-thread experimental native mining session only when the
reviewed ARM64 engine is bundled, its SHA256 matches, AES CPU support is detected,
and explicit user consent, visible notification and device checks pass.
It is not a production miner release. Real-device mining and economics are not yet verified.

The existing Play app (`com.marsx.pool`), ViaBTC integration and production balance
accounting are unchanged. This worker does not register with the Railway registry,
credit a MARS-X account, exchange coins, collect a MARS-X commission or execute withdrawals.
A conversion/withdrawal form creates local drafts only. Its asset choices are not
confirmed exchange pairs. Pool rewards are addressed directly to the user's own wallet.

## Implemented

- Empty-by-default VRSC wallet with mainnet R-address Base58Check validation,
  validated worker names and explicit ownership acknowledgement. No seed, private
  key, operator credential or default/donation wallet is included.
- User-initiated Vipor TLS/subscription/authorization check. The public wallet and
  network IP are disclosed to Vipor. Leaving the activity cancels the check.
- Android NDK ARM64/Bionic cross-build for pinned source and dependencies.
  Packaging verifies reviewed hashes, ELF ABI/interpreter, system-only dynamic
  dependencies, parent-death provenance and 16 KB LOAD/RELRO alignment.
- Native worker behind a single-use loopback relay. Android SSLSocket verifies
  Vipor's certificate and hostname; certificate checks are never bypassed.
- Explicit Start/Stop, foreground notification with Stop action, no automatic
  restart, one compute thread and ten-minute maximum. Lost activity heartbeats,
  backgrounding, revoked consent, thermal veto, connection/process failure and
  task removal stop the session. The native child has an Android parent-death
  SIGKILL constructor; real-device process-death behavior still needs testing.
- Share observer correlates an authorized wallet/worker's outbound mining.submit
  with a matching unique successful TLS pool reply. Unsolicited replies, wrong
  wallets, duplicate replies and rejected shares do not count. Shares never
  create spendable balance or prove payment.

## Experimental limits and remaining gates

The app requires visible activity, external power, battery >=80%, temperature
<38 C, Android thermal status below MODERATE and validated unmetered networking.
Initial sticky battery broadcasts do not establish a fresh event. A non-sticky
battery event must have arrived within five seconds; otherwise the test refuses
or stops. This strict event-freshness check may stop an otherwise healthy device.
It does not prove hardware sensor freshness or certify hardware safety.

Before any public miner or earnings claim:

1. Test actual ARM64 devices: installation/CPU support, native launch, notification,
   battery and thermal behavior, telemetry loss, stop, backgrounding, process death,
   connectivity loss, exact wallet attribution and real accepted shares.
2. Verify provider payment plus blockchain confirmation, map settlements to workers
   and accounts, and reconcile idempotently before real balance accounting.
3. Implement disclosed commission accounting and confirmed conversion/withdrawal
   routes with fees/minimums, destination validation, explicit review and wallet
   signature. These financial execution routes remain disabled.
4. Complete device/16 KB tests, corresponding-source notices and production signing.

## Build and validation

SDK platform/build-tools 36 and Java 17 or ECJ are required. Test signing is for
internal diagnostics only. Build outputs and the internal key are ignored.

```
node --test
MINER_ECJ_JAR=/path/to/ecj.jar bash mobile-miner/android/test.sh
ANDROID_NDK_HOME=/path/to/ndk/27.2.12479018 bash mobile-miner/native/build-android.sh
MINER_ANDROID_SDK=/path/to/sdk MINER_ENGINE_DIR=/path/to/reviewed/artifact bash mobile-miner/android/build-test.sh
```

Without MINER_ENGINE_DIR, the APK has no engine and its native Start control stays
disabled. A newly built engine hash must be reviewed and pinned in EngineArtifact.java
before packaging. The CI builds a no-engine diagnostic APK and separately builds
the engine; a successful compile is not a successful mining/device test.

Source, modifications and dependency license references are in
`android/NATIVE-SOURCES.txt`; ENGINE-LICENSE and PROVENANCE accompany a packaged engine.

## Connection evidence

Vipor `bzdev.vipor.net:5140` passed verified TLS, subscription and operator wallet
authorization in GitHub run 37336141645 on 2026-10-05. This is not evidence of a
real device share or settlement. LuckPool's three TLS endpoints and VerusFarm
failed expiry checks; Cedric Crispin's endpoint failed trust validation. No
certificate bypass or plain remote Stratum fallback was added.

Primary references:
- https://www.bzminer.com/guides/verus.php
- https://vipor.net/mine/verus
- https://verus.io/mining
- https://developer.android.com/guide/practices/page-sizes
- https://github.com/monkins1010/ccminer/tree/1667394ad4120d64b0c57367e71cb832ad2e3645
