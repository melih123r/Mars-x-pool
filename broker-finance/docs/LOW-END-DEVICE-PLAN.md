# Low-end device access and user acquisition

## Current verified build configuration
Android app `minSdk 26` (Android 8.0), `targetSdk 36`. Android 8+ is a *build target*, not a guarantee of successful installation on every handset. Real-device tests and dependency compatibility checks are required before advertising compatibility.

## Access tiers
1. Android 8+ native remote-management app, pending test matrix.
2. Android 5–7: lightweight web dashboard where browser supports modern HTTPS/TLS, fetch and JavaScript; **not** a native APK claim. Android 4.x is best-effort web only; outdated browsers may be unsafe/incompatible.
3. Windows/macOS/Linux: same web dashboard in maintained browsers. No native worker yet.
4. Offline/error states should show a clear message rather than fake earnings or fake online nodes.

## Low-resource UX requirements
- First screen < 100 KB uncompressed target (excluding browser/runtime); no ads SDK or large framework in legacy web mode.
- Large touch targets, simple navigation, low-data mode, no automatic refresh loop, no background compute, no autoplay.
- Manual refresh and explicit consent for registration/telemetry; limit requests and respect metered connections.
- Support Turkish, English, Indonesian and Arabic, including RTL; translation QA before public claims.
- Never require a crypto wallet or payment to test the free dashboard.

## Real-device acceptance matrix
- Android 8, 9, 10, 12, 14, and current Android; 1–2 GB RAM devices for legacy UX.
- Android 5–7 browser smoke tests where safe browsers are available; document failed devices.
- Windows 10/11, maintained macOS, Ubuntu LTS browser smoke tests.
- Test signup, accessibility, error recovery, slow 3G, data usage and app size.

## Growth experiment
- Recruit 20 genuine volunteer beta testers to aim for at least 12 continuously opted-in Play testers; do not purchase fake testers/reviews.
- Create separate invitation links for Turkish and Indonesian language cohorts; ask for feedback and track opt-in and retention with consent.
- A small referral benefit may be credited only after genuine activation and fraud checks; no guaranteed earning claims.
- Measure install success by Android version, day-1/day-7 retention, support tickets and server cost per active user.
- Gate public promotion on live API, tested builds, privacy disclosures and support channel.
