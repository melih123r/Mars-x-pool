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
- Adds a Java-only, SDK-independent disclosure screen that stores no approval and cannot start sharing.
- Adds documentation for the integration gates.
- Does not change Gradle dependencies, Android manifest permissions, Supabase functions, or production networking.
- Requires follow-up PR after SDK and credential verification.

## Credential incident
Any previously pasted SDK key should be revoked and rotated in the supplier dashboard. Never commit the replacement.
