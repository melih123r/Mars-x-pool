# MARS-X Pool / Network DEMO Privacy Policy

Version: 2026-10-23-v4

Controller: AbdilMelih Demirbaş / MARS-X Pool. Privacy and support contact: abdilmelih08@gmail.com, as published on the existing service privacy page.

MARS-X Network DEMO versionCode 18 uses an offline Network launcher with optional Google test advertising as described below. Real bandwidth sharing, partner traffic forwarding, mining, real earnings and payouts are disabled. Language, test consent, session statistics and entered public wallet addresses remain in device-local preferences. Local data can be removed by clearing app storage or uninstalling. The following legacy Pool account and subscription descriptions apply only where those older features are available; the Network launcher does not create an account or initialize Qonversion.

The live store privacy page is https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api/privacy . Its deployed v18 notice is tracked in [docs/network-demo-privacy.html](docs/network-demo-privacy.html).

## Data processed

| Data | Purpose | Basis | Planned retention |
| --- | --- | --- | --- |
| Random installation/worker ID | Bind sessions and identify the remote node | Contract performance and security | Active account plus 90 days |
| Google subject identifier (stored as a keyed hash), verified email and display name | Create and authenticate the MARS-X account | Contract performance | Account life; profile and Google link removed by in-app deletion |
| Referral code, one-level inviter relationship and fee-share ledger | Apply the disclosed invitation reward once and prevent self-referral or code changes | Contract performance and fraud prevention | Account/ledger life as legally required |
| Licence or Qonversion entitlement ID and status | Grant, revoke and audit access | Contract performance | Contract/account life plus required records |
| Qonversion/Google Play user, product, purchase and subscription records | Display local prices, process purchases, restore access and verify active plans | Contract performance | According to the provider settings, legal obligations and account life |
| App/platform version and timestamps | Compatibility, support and activation evidence | Legitimate security/support interests | 12 months |
| Truncated keyed hashes of network and installation identifiers | Rate limiting, fraud investigation and evidence integrity | Legitimate security interests | 90 days unless an incident requires longer preservation |
| Node label, CPU report and last-seen time | Operate remote node status | Contract performance | While registered, then up to 90 days |
| Sandbox balance, destination and payout status | Test accounting and payout workflows without real funds | Contract performance and explicit beta participation | Beta/account life plus required audit records |

The Android client does not retain the raw beta licence key. It stores signed MARS-X licence and account sessions encrypted with Android Keystore. Google Credential Manager returns an ID token only after the user chooses or authorises an account; the server verifies its signature, audience, issuer, expiry and one-time nonce. When the Qonversion project key is configured, the app shares its random installation ID as an external Qonversion identity; the Qonversion SDK and Google Play process SDK/store identifiers, product and transaction status, prices and purchase tokens needed to operate and analyse subscriptions. Facebook attribution collection is disabled in the SDK configuration. Payment-card data is handled by Google Play and is not received by MARS-X. Sandbox destinations are test labels, not wallet credentials. The beta does not request contacts, location, photos, microphone, camera, wallet credentials, identity documents or payment-card data.

After 365 days without licensed account activity, an available `USDT_TEST` balance is moved to a separately recorded dormant client-liability reserve. It is not treated as company revenue and is automatically restored when the same licensed installation returns. This policy concerns test units only; public real-value services require separate legal, identity, custody and payment controls.

## Optional VRSC public pool monitor (2026-10-04 addendum)

After accepting the VRSC screen's notice and pressing refresh, the Android app
sends the entered public VRSC address directly to LuckPool over HTTPS. LuckPool
also receives the connection's network IP. The app reads public worker, hashrate,
pool-reported balance and payment transaction-reference data. These requests
carry no MARS-X login token, licence key, private key or seed phrase.

No automatic polling occurs. Leaving the screen stops the request and clears the
display; the public address remains in device-local preferences until the user
selects Delete saved address, deletes the MARS-X account, or clears app data.
MARS-X does not receive or retain this monitor's address or responses on its
backend. Viewing an address does not establish ownership or credit an account.
The application does not control LuckPool's retention of its own public data and
connection records. Address/IP sharing is disclosed before any request in the UI.

## Sharing

Data may be processed by Supabase (Edge Functions and PostgreSQL), Qonversion, Google Play, infrastructure and app-distribution providers used to operate MARS-X Pool. Cloudflare Workers/D1 is an alternative deployment target and Railway/Redis is a temporary rollback target; they process service data only while actually enabled. Review [Supabase's privacy information](https://supabase.com/privacy), [Cloudflare's privacy information](https://www.cloudflare.com/privacypolicy/), [Qonversion's privacy information](https://qonversion.io/privacy) and [Google's privacy policy](https://policies.google.com/privacy). The production notice must identify all actual processors and relevant international-transfer safeguards. Data is not sold or shared with advertisers; it is disclosed only for service delivery, security, valid legal obligations or protection of legal rights.

## Advertising and consent (Network DEMO)

Network DEMO versions 17 and 18 include Google Mobile Ads and the Google User Messaging Platform (UMP). Advertising is optional and initially off. Selecting the separate test-ad control contacts Google to update advertising privacy choices and display any required consent form. An ad is requested only after a successful privacy update and UMP authorization. The DEMO always uses Google's test banner unit, does not monetize impressions and does not grant rewards or withdrawable balances. Google may collect and share IP-derived approximate location, app/ad interactions, diagnostics and device/app identifiers for advertising, analytics and fraud prevention. Google SDK traffic uses TLS. The DEMO removes advertising-ID and AdServices permissions; this does not eliminate all identifiers or connection data. Network test consent does not authorize advertising. Users can stop ads with the off control and open privacy options where UMP requires them. Turning ads off does not retract already transmitted data. Google retention and handling follow its privacy policy and applicable settings; MARS-X does not promise a specific Google retention period. The earlier legacy statement about no advertiser sharing does not apply to this optional Google SDK processing. The Network launcher does not initialize Qonversion or expose purchases. Legacy Pool code retains Qonversion. Facebook attribution collection is disabled.

## Rights and deletion

Depending on applicable law, a user may request access, correction, deletion, restriction, portability or objection and may withdraw consent where consent is used. The app's Account tab provides a self-service deletion action that removes the Google link, stored profile fields, worker link and active MARS-X account sessions. Pseudonymous ledger entries may be retained only where needed for fraud prevention or legal/accounting obligations. Users in France may complain to the CNIL. Until a monitored privacy address is published, use the repository's private security channel for sensitive requests; do not publish licence keys, full IP addresses or identity documents in a public issue.

## Security

Traffic uses HTTPS. Qonversion's public Project Key may be compiled into the client, while its Secret Key and the Google service-account credentials remain server/dashboard-only. The service independently checks active Qonversion entitlements, then issues short-lived device-bound sessions. It also uses hashed beta licence records, PostgreSQL device binding, rate limiting and pseudonymous audit events; D1 is an alternative store and Redis remains only as the temporary rollback store during migration. Suspected compromise results in revocation, secret rotation and an incident review.
