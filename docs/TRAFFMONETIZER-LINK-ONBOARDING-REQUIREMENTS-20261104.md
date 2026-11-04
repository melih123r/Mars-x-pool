# TraffMonetizer app/link onboarding requirements — 2026-11-04

This note records the partner messages available in the connected mailbox and the safe implementation boundary for MARS-X.

## What the messages actually request

The latest message from Alex (TraffMonetizer, 2026-11-02) says that an SDK agreement was provided through DocuSign and asks to be notified after signing. Earlier messages in the same thread request:

1. A link to the published application for verification.
2. A public website or terms page that explains traffic sharing and user consent.
3. KYC through the provider's verification flow.
4. The SDK agreement before the Android SDK is provided.

The mailbox does not contain a provider API/onboarding URL, SDK archive, endpoint specification, device-attribution contract, or receipt schema. A published Play link is a review link; it is not an SDK/API connection URL.

## Safe MARS-X boundary

- The Android app may show the published Play/terms link and an explicit consent explanation.
- Any provider onboarding link must be an exact HTTPS URL supplied by the provider. Do not invent one or infer it from a token.
- Provider credentials stay in the Supabase secret store. They are never embedded in the APK or sent to Android.
- The gateway remains fail-closed until the signed agreement, official SDK/API package, endpoint contract, device attribution rules, receipt/reconciliation format, required permissions, and test approval are available.
- DEMO balances and local simulations remain separate from provider traffic, real earnings, withdrawals, and payments.
- One provider publisher node serving many MARS-X users is an accounting model only. It does not authorize multiplexing or identify a provider device without written provider rules.

## Required delivery before implementation

- [ ] Exact provider onboarding/deep link, or written confirmation that setup is only through the published app/terms link
- [ ] Signed SDK agreement and official SDK/API artifact
- [ ] API/SDK version, integrity hash, initialization and start/stop callbacks
- [ ] Device/user attribution and duplicate-report rules
- [ ] Provider receipt and publisher reconciliation contract
- [ ] Required Android permissions and Play/Data Safety disclosures
- [ ] Approved test publisher/device and explicit go-live authorization

Until every item above is verified, MARS-X exposes only DEMO onboarding and consent UI. No real traffic, payout, or live publisher switch is enabled.
