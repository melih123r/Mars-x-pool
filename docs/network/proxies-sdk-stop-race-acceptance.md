# MARS-X — Proxies.sx SDK v1.3.2 stop/start release gate

Status: **BLOCKED / SDK-OFF**. This is an acceptance specification, **not** a passing test or approval to route traffic.

## Source-level evidence

Pinned upstream source: https://github.com/bolivian-peru/android-peer-sdk/blob/v1.3.2/sdk/src/main/java/sx/proxies/peer/ProxiesPeerSDK.kt (Git blob `27d4ec4fe808b314eef678be7aaf65256eb7dd27`).

- `start()` launches an asynchronous coroutine, refreshes/registers a device, and subsequently invokes `PeerProxyService.start(...)`.
- `stop()` calls `PeerProxyService.stop(...)` but does not cancel or invalidate the already-running `start()` coroutine.
- Thus a slow registration **may** complete after Stop and start the foreground service. This is a source-level race hypothesis; no actual device failure has been observed.
- `Config` in the tagged source has `apiUrl`, `relayUrl`, `userId`, `onEarningsUpdate`, `onStatusChange`. It does **not** have the bandwidth/charging/mobile restrictions shown in README examples. Do not claim a reliable quota.
- The JitPack AAR bytes and SHA-256 are **not yet verified** against this source.

## Mandatory deterministic tests before SDK start is enabled

1. **Pin and inspect binary:** resolve `com.github.bolivian-peru:android-peer-sdk:v1.3.2` (verify actual Gradle coordinates), save AAR SHA-256, inspect public `ProxiesPeerSDK.Config` bytecode. Fail build if resolved artifact or API differs from reviewed version.
2. **Fake API latch:** use a local fake `/v1/peer/devices` or refresh endpoint that blocks until test releases it. No real farmer key or external relay.
3. **Stop before response:** invoke `start()`, wait for registration request, call `stop()`, then release fake successful response. Assert: foreground service never starts, no WebSocket dial occurs, final status remains STOPPED.
4. **Stop during refresh:** repeat with persisted device token/refresh path; no post-Stop service start.
5. **Rapid transitions:** START → STOP → START → STOP, randomized completion order; last STOP wins. Restart app with consent revoked; no implicit start.
6. **Stale status:** inject delayed provider `online=true` after Stop; UI remains stopped. This complements, but does not replace, draft PR #266.
7. **Fail closed:** backend unreachable, consent absent, expired lease, unknown vendor-scoped bootstrap, or denied device => no SDK init/start. Never ship farmer master key in APK, AAB, source, logs, or client provisioning response.
8. **Physical test, approval-gated:** owned Android 13–16 device, explicit consent, approved scoped vendor credentials and isolated relay. Observe FGS permission/notification, device ID, provider self-test, stop/revoke, relay disconnect and OS per-UID bytes. No third-party customer traffic or monetary transaction.

## Fix acceptance criteria

A safe fix must invalidate any in-flight SDK start at the **SDK coroutine boundary** (e.g. generation token / cancellation and a synchronized last-moment consent check before `PeerProxyService.start`). A UI-only `stop()` guard does not prove the library's pending coroutine cannot start later. An upstream vendor patch and new pinned binary are preferable. Any local fork must undergo source review and reproducible binary verification.

**Release gate:** do not enable SDK sharing unless the fake-server tests pass, approved real-device relay + revoke is demonstrated, farmer-key-free device-scoped bootstrap is documented, and consent / Android FGS policy checks pass. If vendor API does not support this, retain SDK-OFF demo.

**Estimated incremental CI cost:** $0 assuming existing runners; **engineering estimate:** 1–2 days for test harness, vendor SDK fix timeline unknown. Physical data/provider fees unknown and require approval.

Related: https://github.com/melih123r/Mars-x-pool/issues/264 ; https://github.com/melih123r/Mars-x-pool/pull/261 ; https://github.com/melih123r/Mars-x-pool/pull/263 ; https://github.com/melih123r/Mars-x-pool/pull/266 .
