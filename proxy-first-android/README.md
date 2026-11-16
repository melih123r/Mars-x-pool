# Standalone proxy-first Android prototype

This is an isolated development app, not the existing MARS-X Pool application. Package `com.marsx.proxyprototype` is a development identifier. **The official Proxies.sx SDK v1.3.2 is now declared as a build dependency, but it is never initialized or started. There is no API key, earnings, or network sharing.** The SDK may merge network and foreground-service permissions into the final manifest; inspect the merged manifest before distribution. Start is disabled and consent is session-only. This is not approved for Google Play.

Build with Java 17, Android SDK 36 and Gradle 8.x: `gradle :app:testDebugUnitTest :app:assembleDebug` from this folder. No build has been run here.

Release blockers: Play proxy-primary-purpose review; vendor-confirmed device-scoped revocable bootstrap credentials; Android SDK signature and manifest validation; LAN isolation and abuse prevention; functioning immediate Stop and background behavior; informed consent, privacy policy, Data Safety declarations, consumer and regional compliance. Never embed the farmer API key.

Policy: https://support.google.com/googleplay/android-developer/answer/16559646

## Automated validation

The `.github/workflows/proxy-first-android.yml` workflow runs isolated Java unit tests, builds a debug APK, and checks that the prototype source contains no INTERNET permission, vendor SDK dependency or literal `psx_` key. It uploads a **nonfunctional** debug prototype artifact. Do not distribute this artifact as a working earning app.

The GitHub Actions results must be checked; adding the workflow does not mean the build passed.

## Credential verification questions for Proxies.sx

Before enabling traffic, obtain written answers from the vendor:

1. Can the Android SDK initialize with a **short-lived, single-device bootstrap token** instead of a reusable farmer account SDK key?
2. Can a compromised device's bootstrap token be revoked independently without interrupting other devices?
3. What prevents proxy clients from reaching RFC1918/loopback/link-local or other private-network addresses through a participating device?
4. How are malicious client activity, carrier costs, and user complaints handled, and what bandwidth/connection controls are enforceable?
5. What data and device identifiers does SDK 1.3.2 collect, and which foreground-service permissions and notifications are required?

Until these are answered and tested, no SDK or proxy networking is permitted in the prototype.

## Proxies.sx vendor review screenshots

Open the installed **debug APK on an Android device/emulator** and capture three authentic screenshots:
1. `1. Disclosure` — third-party traffic risks and voluntary opt-in (unchecked by default).
2. `2. Stop control` — Stop sharing button and default OFF status.
3. `3. Connection status` — truthful DISCONNECTED / SDK NOT INSTALLED state.

**Do not submit these as screenshots of a working Proxies.sx SDK integration.** They demonstrate UI only. Maya requested screenshots of a *working version*, so vendor approval for these prototypes must be sought before representing them as sufficient. The app does not share traffic or generate earnings; the SDK is present as a dependency but remains uninitialized.

The vendor's request to onboard ~11,000 devices in stages (starting with ~1,000) is a future rollout plan, **not authorization** to turn on traffic. Require agreement, Play review, individual user consent, device-scoped credentials and security verification first.

## Vendor communication gate

Before sending screenshots, confirm whether Proxies.sx will accept **UI-only prototype screenshots**. Their email requests screenshots from a working application; this prototype is deliberately disconnected. Do not claim it is connected, or that it has handled traffic.

Ask the vendor to provide official SDK initialization API documentation, a device-scoped provisioning design, private-network blocking details, and a testing/sandbox method **without production customer traffic**. Do not share farmer credentials by email or place them in this repository.

## SDK wiring status (2026-11-16)

JitPack and `com.github.bolivian-peru:android-peer-sdk:1.3.2` are configured **only in this separate prototype**. This validates dependency resolution/build compatibility. SDK initialization and `start()` are deliberately not called: the published API currently documents a farmer key as the initialization credential, and distributing that key in an APK would expose it to extraction. The final merged manifest may include SDK-added network and foreground-service permissions. A successful build does not mean production authorization or actual traffic sharing.

## Vendor dashboard findings

The vendor's dashboard explicitly documents the Android artifact `com.github.bolivian-peru:android-peer-sdk:1.3.2`, relay `wss://relay.proxies.sx`, and `ProxiesPeerSDK.init(context, API_KEY, PeerConfig(...))` followed by `getInstance().start()/stop()`. These are **Kotlin examples**; Java API signatures must be verified against the downloaded SDK before wiring an Activity.

The vendor also offers a separate SDK/device API key, but its documented example passes that key directly into the SDK. A separate key is **not necessarily safe to embed in a public APK**: anyone extracting it could register or impersonate devices. Obtain a vendor-supported, revocable per-device token flow or other secure provisioning design before production activation. Keep SDK Start disabled until then.

The dashboard reports zero registered/online peers and zero traffic at the time the user shared it; this is not evidence of a live integration.

## Supabase deployment verification

The existing MARS-X Supabase project now hosts an active `marsx-proxy-provisioning` Edge Function with JWT verification enabled. The deployed endpoint is intentionally fail-closed: authenticated requests return `503 not_ready`, no SDK credentials are issued, and no Proxies.sx registration call is made. This is a deployment check, **not a working device authorization integration**.

Never expose a shared Proxies.sx SDK key to the app. Before activation, verify whether the Android SDK supports the per-device JWT/refreshToken from `/v1/peer/agents/register`, and verify revocation and immediate stop behavior. Do not register 11,000 devices before user consent and vendor agreement.
