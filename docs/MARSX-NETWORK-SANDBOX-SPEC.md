# MARS-X Network — consent-first sandbox specification (2026-10-15)

Status: **design and test-only**. No residential proxy, customer traffic forwarding, monetization SDK, actual earnings or payout enabled.

## Research gates
- Google Play Device and Network Abuse policy: third-party proxy service must be the app's primary, user-facing core purpose. Do not bundle it as a background add-on to MARS-X Pool.
- Bright SDK requires opt-in/out and compliance review before production; unapproved apps do not earn revenue.
- Honeygain SDK requires clear consent and continuous opt-out. Partner acceptance and contractual rates are unknown.
- A user's IP address is potentially personal data under GDPR; privacy notices and data mapping need review.
- Third-party client traffic must not run in this sandbox.

## State machine
OFF -> CONSENT_PENDING -> READY -> TEST_RUNNING -> STOPPED
Any state -> STOPPED on opt-out, network loss, low battery, or thermal threshold.
Only the user may explicitly start a test. Default is OFF.

## Acceptance tests
1. Fresh install OFF; no test network requests before opt-in.
2. Reject consent: remain OFF, no telemetry.
3. Accept consent: READY; still no traffic until Start.
4. Start: only HTTPS requests to an operator-owned test endpoint; reject arbitrary destinations.
5. Stop: immediately cancel scheduled requests and reset running flag.
6. Network lost, battery <=15%, device temperature >=43 C: stop.
7. Counter increments only on server-acknowledged test responses.
8. Display TEST POINTS, never currency or withdrawable balance.
9. Do not download or execute code from outside Google Play.
10. Android 8+ support requires foreground-service/background restrictions testing on real devices.

## Next steps
1. Obtain written partner terms and Google Play policy review.
2. Implement standalone Android Network app with explicit consent, foreground notification, and sandbox endpoint allowlist.
3. Add server-side signed test receipts and idempotency keys.
4. Run Android instrumented tests and reproducible APK build.
5. Enable commercial integration only after independent legal, privacy, security and partner approvals.

References:
- https://support.google.com/googleplay/android-developer/answer/16559646
- https://help.bright-sdk.com/hc/en-us/articles/16677662220817-Android-SDK-Integration-Guide
- https://help.bright-sdk.com/hc/en-us/articles/16569559641745-Is-app-review-by-Bright-SDK-mandatory
- https://sdk.honeygain.com/faq/
