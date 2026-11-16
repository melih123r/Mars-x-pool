# Standalone proxy-first Android prototype

This is an isolated development app, not the existing MARS-X Pool application. Package `com.marsx.proxyprototype` is a development identifier. **No Proxies.sx SDK, API key, INTERNET permission, service, earnings, or network sharing.** Start is disabled and consent is session-only. This is not approved for Google Play.

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

**Do not submit these as screenshots of a working Proxies.sx SDK integration.** They demonstrate UI only. Maya requested screenshots of a *working version*, so vendor approval for these prototypes must be sought before representing them as sufficient. The app does not share traffic or generate earnings.

The vendor's request to onboard ~11,000 devices in stages (starting with ~1,000) is a future rollout plan, **not authorization** to turn on traffic. Require agreement, Play review, individual user consent, device-scoped credentials and security verification first.
