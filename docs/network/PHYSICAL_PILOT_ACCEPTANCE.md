# Proxies.sx physical pilot acceptance — release blocker

This is a **manual evidence gate**, not a claim that CI can exercise a real carrier network. PR #270 remains draft and live traffic must remain OFF until every item below has independently verified evidence.

## 1. Credential architecture (BLOCKED)
- Rotate/revoke any previously shared farmer/master key in the vendor portal.
- Never put the vendor master key in BuildConfig, APK/AAB, source, CI artifacts, logs, email, or a public issue.
- Current `BuildConfig.PROXIES_SX_API_KEY` is a compile-time string and **must not be used with a production master key**. Empty-key builds remain SDK-OFF.
- Obtain written vendor confirmation of a revocable, short-lived, device-scoped credential flow. Backend must authenticate the app user/device, issue only scoped credentials, apply TTL and rate limits, and revoke on user opt-out. If vendor only supports a master key passed to the Android SDK, **do not ship live sharing**; request vendor support or use a server-controlled non-sharing fallback.
- Confirm that the SDK does not re-register on HTTP 401/404 after revocation; test server-side revocation and restart.

## 2. Owned Android device tests (BLOCKED)
Record build SHA, APK SHA-256, device model/OS, network type, timestamp, anonymized device identifier, vendor dashboard observation, and sanitized logcat. Never record secrets or personal traffic.
1. Fresh install: consent OFF, sharing OFF, no vendor registration, no relay traffic.
2. Explicit consent: show vendor, mobile data/IP usage and revocation information; do not start until the user separately presses Start.
3. Start: verify SDK connected **and** vendor dashboard device identity, routing/self-test and authorized traffic counters. Distinguish diagnostic traffic from paid customer traffic; never infer revenue from local byte counters.
4. Stop during CONNECTING and immediately after CONNECTED, 20 iterations each: ensure no late start, no further relay traffic, and no background restart.
5. Revoke consent while CONNECTING and CONNECTED, 20 iterations each; force-stop/relaunch/reboot, toggle Wi-Fi/mobile data, and repeat. Confirm server-side token invalidation and no re-registration.
6. Airplane mode, lost connectivity, app background/foreground, battery restrictions, and process death: no unauthorized sharing; UI must reflect actual provider state.
7. Verify device dashboard and earnings API independently; show unavailable/unknown rather than fabricated live numbers.

## 3. Release decision
- Required CI checks green on exact candidate SHA; review R8 release AAB, install signed pilot artifact on a physical device.
- Independent privacy/security review and vendor approval; verify applicable platform and carrier rules.
- Attach redacted evidence to private QA records; only non-sensitive pass/fail and hashes to issue #264.
- **Do not merge, distribute, or enable live relay until all blockers pass.** A green CI result proves compilation and automated checks, not live traffic.
