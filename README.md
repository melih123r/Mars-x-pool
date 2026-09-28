# MARS-X Pool Beta 0.8.2

MARS-X Pool is an authorised Android remote node/pool management beta. It does **not** mine cryptocurrency on the Android device, run third-party workloads, promise earnings, perform hidden background compute or transfer real money in sandbox mode. Beta 0.8.2 keeps the zero-cost Supabase Edge Function + private PostgreSQL deployment, three-tab interface, Google Credential Manager sign-in, self-service account deletion and one-level referral ledger, and expands the interface from four to eight languages. Railway/Redis remains a temporary rollback target only.

## Live API

Current zero-cost endpoint:

```text
https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api
```

- `GET /health` — public readiness, storage and licence configuration status.
- `GET /privacy` — public privacy notice.
- `POST /billing/qonversion/session` — server-side exchange of an active Qonversion entitlement for a short device-bound MARS-X session.
- `POST /auth/google/nonce` and `POST /auth/google/exchange` — one-time nonce issuance and server-verified Google ID-token exchange.
- `GET /auth/me` and `POST /auth/delete` — device-bound account profile/referral view and self-service account deletion.
- `POST /license/activate` — licence-key verification, terms acceptance and persistent device binding.
- `GET /license/status` — validates an expiring device-bound licence session.
- `POST /register` and `POST /heartbeat` — require `Authorization: License <session>` and the bound installation ID.
- `GET /account`, `GET /payouts` and `POST /payouts` — device-bound licensed sandbox balance and idempotent payout simulation; these routes cannot transfer real funds.
- `GET /workers` and `GET /summary` — operator-only routes requiring `Authorization: Bearer <WORKER_TOKEN>`.
- `/admin/credits`, `/admin/payouts` and `/admin/dormancy/*` — separate operator routes requiring `Authorization: Bearer <ADMIN_TOKEN>`.

## Zero-cost Supabase deployment

The Android Beta 0.8.2 build uses the live Beta 0.8.1 `marsx-pool-api` Supabase Edge Function, which stores its records in the private `marsx_pool` PostgreSQL schema. Client roles have no schema privileges and explicit deny policies. Server credentials belong in Supabase Vault, never in source, the APK/AAB or a public table. Apply the migrations under `supabase/migrations/` and deploy the function under `supabase/functions/marsx-pool-api/`.

The selected Supabase organization is on the Free plan. The app must not be switched to a paid plan or paid add-on without an explicit owner decision. See `docs/SUPABASE-ZERO-COST-DEPLOYMENT.md` for verified limits, deployment checks and the Railway retirement gate.

## Cloudflare alternative

The original Cloudflare target remains available under `cloudflare/`, backed by D1. It implements the same routes, but is not required for the current deployment.

```bash
npm install
npm run cf:check
npm run cf:db:local
```

Create the Cloudflare project, copy the D1 database ID into `cloudflare/wrangler.toml`, apply the remote migration and add secrets as described in `docs/CLOUDFLARE-ZERO-COST-DEPLOYMENT.md`. Never place a real secret in `wrangler.toml`, Git, the APK or `.dev.vars.example`.

Build the Android application with either deployed URL:

```bash
gradle -p android :app:bundleRelease \
  -PMARSX_API_BASE_URL=https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api \
  -PQONVERSION_PROJECT_KEY=project_key_from_qonversion \
  -PGOOGLE_WEB_CLIENT_ID=web_oauth_client_id.apps.googleusercontent.com
```

If `MARSX_API_BASE_URL` is omitted, Beta 0.8.2 uses the live Supabase endpoint. Do not delete Railway until Supabase `/health`, licence activation, registration, account, Google authentication and payout-sandbox checks pass.

## Railway rollback variables

The existing `worker-registry` service requires:

```text
WORKER_TOKEN=<random operator-only secret>
ADMIN_TOKEN=<different random sandbox-payout admin secret>
REDIS_URL=redis://telemetry-store.railway.internal:6379
LICENSE_PEPPER=<different random secret, at least 32 characters>
LICENSE_SESSION_SECRET=<another random secret, at least 32 characters>
LICENSE_TOKEN_TTL_SECONDS=2592000
LICENSE_RECORDS_JSON=[...]
QONVERSION_SECRET_KEY=sk_server_secret_from_qonversion
QONVERSION_ENTITLEMENT_IDS=pro,farm
QONVERSION_SESSION_TTL_SECONDS=86400
GOOGLE_WEB_CLIENT_ID=<Google Auth Platform web client ID>
AUTH_SUBJECT_PEPPER=<separate random secret, at least 32 characters>
MIN_PAYOUT_UNITS=1000000
DORMANT_AFTER_MS=31536000000
```

Keep `telemetry-store` private; do not add a public Redis TCP proxy. Never commit real secrets. `WORKER_TOKEN`, `ADMIN_TOKEN`, `LICENSE_PEPPER` and `LICENSE_SESSION_SECRET` must be different. `QONVERSION_SECRET_KEY` is server-only. The Google service-account JSON belongs only in the Qonversion dashboard and must never enter the repository or APK. `/health` reports the active licence provider without exposing a credential.

`USDT_TEST` is deliberately non-withdrawable and must never be presented as real money or guaranteed earnings. After 365 days without licensed account activity, the available test balance moves to a separately recorded client-liability reserve. It is not company revenue and is restored automatically when that licensed installation returns. Pending payout reservations keep their normal audit trail.

Generate a customer licence record locally with `LICENSE_PEPPER` present:

```bash
npm run license:generate
```

Give the displayed key to the authorised tester once. Store only the generated record in `LICENSE_RECORDS_JSON`. Redis enforces the configured device-seat limit across Railway restarts; D1 enforces the same rule after Cloudflare migration.

## Development and Android

```bash
npm install
npm test
npm start
```

The Android project is under `android/`. Release builds enable R8 minification. The app never stores a raw beta key after activation; licence and Google account sessions are encrypted through Android Keystore. Returning authorised Google accounts can use Credential Manager auto-select; a new account must tap the visible Google button so an optional referral code can be applied only once.

To activate the subscription UI in a build, provide the public Qonversion SDK Project Key:

```bash
gradle -p android :app:bundleRelease -PQONVERSION_PROJECT_KEY=project_key_from_qonversion
```

Without that key, the purchase controls remain disabled. The planned mappings are Qonversion products `pro_monthly` and `farm_monthly`, Google Play products `marsx_pro_monthly` and `marsx_farm_monthly`, and entitlements `pro` and `farm`. Follow `docs/QONVERSION-SETUP.md` before producing a payment-enabled build.

GitHub Actions tests the backend, checks all eight translation sets and assembles a debug APK. The interface follows the device language in English, Turkish, Indonesian, Arabic, Hindi, Bengali, Urdu and Vietnamese; Arabic and Urdu use right-to-left layout. Public distribution should use a signed AAB with Play App Signing and Play Integrity. The Qonversion SDK checks entitlements in the app; the MARS-X backend independently resolves the Qonversion identity and entitlement before issuing a short session.

The CI release gate also runs `scripts/check-release.py`, Android release lint and `bundleRelease`. It uploads a tester APK and an unsigned release AAB; the AAB must be signed with the publisher's private upload key before Play Console submission. Store copy, Data safety answers and the tester procedure are prepared in `docs/PLAY-STORE-LISTING.md`, `docs/DATA-SAFETY-DRAFT.md` and `docs/CLOSED-BETA-RUNBOOK.md`.

## Closed testing and advertising

Invite 20 genuine testers so at least 12 remain opted in continuously for 14 days and provide real feedback. Do not buy testers, reviews or fake activity. See `docs/USER-ACQUISITION-PLAN.md` and `docs/MARKET-AND-MONETIZATION-PLAN.md` for the USD 10/month India→Indonesia test and the Oman/UAE direct-partnership route.

`docs/PARTNER-SHORTLIST.md` records verified public channels for Omanhash, Green Data City and Phoenix Group. `docs/PARTNER-OUTREACH-DRAFT.md` is a draft only and must not be sent without the owner's approval.

Beta 0.8.2 intentionally contains no advertising SDK. Qonversion and Play Billing are integrated but cannot take payment until the real Qonversion/Play accounts, products and keys are configured. The separate payout screen remains a sandbox even after subscription setup. Add advertising only after the required consent, Data safety and production ad-unit identifiers are ready.

The referral is deliberately single-level. A completed sandbox payout models a two-percent platform fee; when the user joined with a valid inviter, three percent of that fee (an effective 0.06 percent of gross) is credited to the inviter. The invited user's net amount is unchanged by the referral. Without a referral, the full platform fee stays with MARS-X.

Qonversion was chosen over Adapty and RevenueCat because its published free tracked-revenue allowance and post-threshold rate were the cheapest of the three when checked on 26 September 2026. See `docs/LICENSING-PROVIDER-DECISION.md` for the comparison and trust boundary.

Google Play prohibits cryptocurrency mining on devices, so device mining and hidden/background computation remain outside this project. The store listing must accurately describe remote management; complete the Financial features declaration if the final product enables crypto-related earnings or tokenised assets.

## Licence and enforcement

This repository is source-visible but **not open source**. `LICENSE` grants only limited authorised use and prohibits copying, redistribution and licence-control bypass subject to mandatory law. Source visibility does not make the code free to reuse. See `docs/ENFORCEMENT-PLAYBOOK.md` for evidence preservation and proportionate response.

Before taking payments, add working privacy/support contact details, complete Data safety disclosures, and have the French consumer terms reviewed.
