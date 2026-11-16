# CURRENT DECISION — GOOGLE PLAY REVIEW (2026-11-16)

**Do not ship third-party proxy functionality in the existing MARS-X Pool Play app.** Google Play's Device and Network Abuse policy permits third-party proxy services only when proxy sharing is the app's primary, user-facing core purpose. MARS-X Pool currently manages remote nodes/pools; a proxy earnings add-on is not compliant merely because it has an opt-in screen.

**Implemented on this branch:** the Play build has no Proxies.sx SDK dependency or JitPack repository, no service, no proxy traffic, and no consent capture for an unavailable feature. The informational screen removes any consent saved by the earlier preparation preview and explains that sharing is unavailable. `ProxiesConsentPolicy` remains as a pure, unused policy helper with unit tests; it cannot start traffic.

**Before any new Play-facing proxy app:** design a genuinely proxy-first product, verify actual SDK permissions, Google Play SDK/foreground service rules, clear prominent disclosure and opt-in, privacy policy, Data Safety form, account deletion, revocation, device credentials, private LAN isolation and user data costs. A separate package and listing may be appropriate; a new app is not automatically approved.

Official policy:
- https://support.google.com/googleplay/android-developer/answer/16559646
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/18265346

**Historical notes below describe previous experimental preparation and are superseded by this decision.** Do not follow their Gradle instructions on the Play branch.

---

# Proxies.sx Android integration — gated preparation

Status: **not connected**. This branch deliberately does not run proxy traffic.

## Existing architecture
- Java Android app under `android/`, minSdk 26, targetSdk 36.
- `MainActivity` builds the home, earnings and account pages programmatically.
- `SecureStore` encrypts existing sessions using Android Keystore.
- Supabase Edge Functions serve the backend. Existing MARS-X earnings are sandbox balances.

## Security and consent gates
1. Obtain written confirmation of Proxies.sx Android SDK artifact, Java API signatures, Android 14–16 foreground service requirements, data caps, and credential model. Do not assume Kotlin examples work from Java.
2. Verify supplier agreement, peer provenance, permitted devices, opt-out, and Google Play policy. The app currently describes itself as a remote-node management app, not a third-party proxy service.
3. Show a dedicated, non-prechecked disclosure and require a deliberate opt-in before any network sharing. Disclose third-party traffic, public IP attribution, data usage and potential carrier fees, battery use, abuse risk, and a permanent Stop control. Denial must leave all existing app features usable.
4. Persist a versioned consent record locally; revocation clears it and stops the service. Never start on app launch, reboot, sign-in, or background transition without an independently reviewed policy and explicit choice.
5. Keep supplier master API keys server-side only. **Android Keystore protects stored secrets at rest but does not make an SDK credential unextractable while running.** Do not embed master credentials in Gradle, BuildConfig, assets, APK, logs, or GitHub Actions. Only enable traffic after the vendor confirms a revocable, scoped per-device credential scheme or another reviewed alternative.
6. Verify foreground service type, persistent notification, runtime permissions, Android 13+ notification behavior, target SDK 36 requirements, and merged manifest. Do not add speculative service declarations.
7. Keep Proxies.sx verified traffic/earnings separate from MARS-X sandbox credits and payouts. No revenue promises.
8. Add integration tests for consent accepted/denied/revoked, restart, log-out, network loss, quota exhaustion, and credential expiry; then test a real device and CI build before any release.

## Scope of this PR
- Adds a Java-only, SDK-independent disclosure screen with an unchecked explicit opt-in and revocation control; consent is versioned in private SharedPreferences, but cannot start sharing.
- Adds documentation for the integration gates.
- Does not change Gradle dependencies, Android manifest permissions, Supabase functions, or production networking.
- Requires follow-up PR after SDK and credential verification.

## Credential incident
Any previously pasted SDK key should be revoked and rotated in the supplier dashboard. Never commit the replacement.

## Verified current vendor release (checked 2026-11-16)

- Latest published Android SDK: **1.3.2**, tagged 2026-09-02.
- Vendor-documented Gradle artifact: `com.github.bolivian-peru:android-peer-sdk:1.3.2`; JitPack must be added to `android/settings.gradle` under `dependencyResolutionManagement.repositories` when dependency activation is approved.
- Java Android host must verify Kotlin SDK interoperability against the actual published artifact before invoking methods. No speculative method signatures.
- SDK manifest merges INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC, WAKE_LOCK and READ_PHONE_STATE. The app already declares POST_NOTIFICATIONS; Android 13+ requires runtime handling.
- SDK 1.3.2 **does not provide a functioning data usage cap**. Published configuration supports apiUrl, relayUrl, userId and status/earnings callbacks, not the older documented maxBandwidthMBPerHour/onlyWhenCharging/mobileDataOnly options. Do not claim those limits are enforced.
- IP rotation is not available in SDK 1.3.2.
- Vendor notes Google Play permits third-party proxying only when it is the app's primary user-facing purpose. MARS-X Pool currently has a different primary purpose; shipping the SDK through Play needs a distribution/policy decision first.
- SDK requires a farmer key for account linkage. Vendor has not established a safe scoped credential distribution mechanism for this app. A key fetched from Supabase still becomes accessible to the app runtime and is not inherently secret from the device owner.
- Vendor documents no verified restriction against customer tunnels reaching private LAN addresses. Do not enable sharing on a network with sensitive devices without independent mitigation and review.
- SDK is intentionally **not** included in the Gradle build in this PR, and there is no network proxy start path.

References:
- https://www.proxies.sx/sdk/android
- https://www.proxies.sx/sdk
- https://github.com/bolivian-peru/android-peer-sdk
- https://www.proxies.sx/earn/what-runs-on-my-device

## Vendor credential verification — 2026-11-16

The official Android integration guide documents `ProxiesPeerSDK.init(context, apiKey, config)` using a farmer dashboard **SDK/device key**. The key associates **every device** initialized with it to the farmer account. The guide does **not** document a server-side exchange for individually scoped, short-lived Android SDK bootstrap credentials or an API to revoke just one exposed SDK key without affecting other devices.

The public peer protocol has device JWTs and refresh tokens **after registration**; these are not a documented substitute for the farmer key required by the Android SDK's initialization. A key fetched from Supabase would still be accessible to the Android process. Android Keystore encrypts local storage, not the key while in memory.

**Decision:** Do not provision the farmer key to MARS-X APKs or enable the SDK on this existing general-purpose Google Play app. A follow-up implementation requires vendor-confirmed revocable per-device bootstrap credentials (or an independently security-reviewed isolated distribution model) and a separate Play-policy decision.

### Verified Java interoperability boundary

Official examples are Kotlin and SDK 1.3.2's public methods include `init`, `getInstance`, `start`, `stop`, `getStatus`, and `isRunning`. The published guide also documents `getEarnings()` as a Kotlin suspend function; **do not call it directly from Java as though it were synchronous**. Before writing Java calls, resolve the AAR in an isolated test project and inspect JVM signatures with `javap` (including `Config` constructor/default arguments and `Continuation` parameters). This verification has not been run in this PR.

### Build and release checks

- Confirm vendor JitPack coordinate against the tagged release (vendor pages differ on the optional `v` prefix).
- Verify merged manifest and Android 14+ foreground-service restrictions; the SDK declares a `dataSync` service.
- Keep consent revocation working offline and before authentication.
- SDK 1.3.2 provides **no enforced bandwidth cap** and supplier has not published verified private-LAN isolation; do not market those protections.
- Run Gradle compile, Android instrumentation, dependency vulnerability scan, and Google Play policy review before considering release.

Vendor references:
- https://www.proxies.sx/sdk/android
- https://www.proxies.sx/peers
- https://www.proxies.sx/sdk/platform-policy/google-play
- https://www.proxies.sx/earn/what-runs-on-my-device

## Optional dependency resolution (not runtime integration)

The Android Gradle files now include JitPack and an **opt-in `compileOnly` dependency** on `com.github.bolivian-peru:android-peer-sdk:1.3.2`. By default the vendor dependency is not resolved or packaged. The flag is only for checking that Gradle can resolve the published artifact; no SDK Java calls are compiled yet.

Run in a development environment with Android SDK and network access:

```sh
gradle -p android :app:testDebugUnitTest
gradle -p android :app:assembleDebug -PVERIFY_PROXIES_SX_SDK=true
```

The second command does **not** include the SDK in the APK because it is `compileOnly`. It also does not validate Java method signatures: that requires an isolated Java interoperability test against the resolved AAR. These commands have not been executed in this session.
