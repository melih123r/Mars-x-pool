# TraffMonetizer connection preparation

This branch is preparation only. It does not contain the vendor SDK, an authenticated connection, routing, earnings or payouts. Do not promote its versionCode 18 artifacts to Play: the published v18 remains a different artifact. Assign a new versionCode and rebuild/sign after approved app changes are finalized.

## App-owned boundary

`NetworkPartnerConnection` defines our own internal Driver port, not vendor method names. The only production factory is `demo()`, which always blocks start. No runtime setting, test consent, publisher ID or AdMob ID unlocks routing. NetworkHomeActivity forwards consent withdrawal, onStop and onDestroy to stop. Existing Start remains an app-only traffic monitor. This conservative foreground-only preparation is not a completed Android background service.

Unit tests use an in-memory fake, never a vendor SDK. START_REQUESTED is not CONNECTED, billable bytes or revenue. Failed stop is surfaced and prevents restart until cleanup succeeds. Before introducing a real driver, map asynchronous start/stop callbacks and prove actual teardown; do not assume the synchronous port is sufficient for the unknown SDK.

## Required delivery from the partner

After public Network listing review, publisher KYC and accepted agreement, obtain the official SDK artifact/repository and version, integrity information, integration/sample documentation, initialization and device-attribution rules, start/stop and error callbacks, required permissions and supported Android versions, background lifecycle rules, data disclosures and revenue reporting contract. These details are not yet available and are not guessed here.

Confirm permission before placing confidential SDK material in private CI or automated development services. Never put publisher secrets, SDK binaries or confidential documents into this public repository. Vendor credentials must follow the official SDK security model; an APK cannot keep a shared secret confidential. Do not use AdMob identifiers as TraffMonetizer credentials.

## Activation sequence

1. Verified signed DEMO AAB, Google production access and approved public listing.
2. Partner verifies the public Network listing; publisher completes official secure KYC; agreement is accepted by both parties. A developer-signed PDF alone is insufficient.
3. Receive and review official SDK, implement the driver on an isolated integration branch, initially disabled. Determine a trusted, revocable authorization mechanism; the test boolean in this preparation is not that mechanism.
4. Fresh LIVE_SHARING consent distinct from existing DEMO consent. Test denial, revocation, force stop, background, reconnect and kill switch on real devices. Update Play privacy/data declarations and review the SDK-bearing release.
5. Separate explicit live-traffic approval. No earnings from TrafficStats: use only authenticated provider accounting and reconciliation.
6. Separate payment design, settled balance checks and payment approval. Partner pays the publisher; this preparation never transfers funds to users.

AdMob test ads remain separate from bandwidth consent and SDK approval. No real-ad monetization or cash rewards are enabled by this change.
