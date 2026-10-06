# Cloudflare Workers + D1 zero-cost deployment

This runbook migrates the MARS-X API from an always-on Railway/Redis service to the serverless Worker included in Beta 0.8. Railway remains online until all checks pass.

## Cost-control design

- Cloudflare Worker handles HTTPS requests and scales to zero between calls.
- D1 stores device seats, worker records, sandbox balances, idempotency records and payout audit entries.
- Qonversion entitlement exchange issues a 24-hour device-bound session, avoiding a partner API call on every heartbeat.
- The app sends register/heartbeat requests only after explicit user actions. Do not add rapid background polling.
- A daily Cron Trigger performs the dormant-account safeguard without an always-on process.

Free-plan limits can change. Monitor request and D1 usage in Cloudflare, set notifications, and do not assume a free tier is an uptime guarantee.

## 1. Authenticate and create D1

From the repository root:

```bash
npx wrangler login
npx wrangler d1 create marsx-pool
```

Copy the returned database ID into `cloudflare/wrangler.toml`, replacing `REPLACE_AFTER_D1_CREATE`. Do not change the `DB` binding name.

Apply the schema:

```bash
npx wrangler d1 migrations apply marsx-pool --remote --config cloudflare/wrangler.toml
```

## 2. Store secrets

Run every command and paste the existing server value only into Wrangler's hidden prompt:

```bash
npx wrangler secret put WORKER_TOKEN --config cloudflare/wrangler.toml
npx wrangler secret put ADMIN_TOKEN --config cloudflare/wrangler.toml
npx wrangler secret put LICENSE_PEPPER --config cloudflare/wrangler.toml
npx wrangler secret put LICENSE_SESSION_SECRET --config cloudflare/wrangler.toml
npx wrangler secret put LICENSE_RECORDS_JSON --config cloudflare/wrangler.toml
npx wrangler secret put QONVERSION_SECRET_KEY --config cloudflare/wrangler.toml
npx wrangler secret put GOOGLE_WEB_CLIENT_ID --config cloudflare/wrangler.toml
npx wrangler secret put AUTH_SUBJECT_PEPPER --config cloudflare/wrangler.toml
```

`WORKER_TOKEN`, `ADMIN_TOKEN`, `LICENSE_PEPPER`, `LICENSE_SESSION_SECRET` and `AUTH_SUBJECT_PEPPER` must be separate values. `GOOGLE_WEB_CLIENT_ID` is the Google Auth Platform Web OAuth client ID used as the ID-token audience. The Qonversion key is server-only. Never upload the Google Play service-account JSON here; it belongs only in the Qonversion dashboard.

## 3. Deploy and verify

```bash
npm run cf:check
npx wrangler deploy --config cloudflare/wrangler.toml
curl https://marsx-pool-api.<your-subdomain>.workers.dev/health
```

Expected health fields include `"version":"0.8.4"`, `"storage":"d1"`, `"persistent":true`, `"licensing":"ready"`, `"google_auth":"ready"` and `"payoutMode":"sandbox"`.

Then test, in order:

1. Google sign-in, returning-user auto-select, nonce replay rejection and in-app account deletion.
2. Referral-code lock, self-referral rejection and the disclosed fee-share calculation.
3. Beta licence activation on one authorised test device.
4. Qonversion sandbox purchase and purchase restoration.
5. Node registration and one heartbeat.
6. Sandbox account display, credit through the protected admin endpoint and idempotent payout request.
7. Wrong-device rejection and invalid-token rejection.

## 4. Point Android to Cloudflare

```bash
gradle -p android :app:bundleRelease \
  -PMARSX_API_BASE_URL=https://marsx-pool-api.<your-subdomain>.workers.dev \
  -PQONVERSION_PROJECT_KEY=project_key_from_qonversion \
  -PGOOGLE_WEB_CLIENT_ID=web_oauth_client_id.apps.googleusercontent.com
```

The endpoint remains editable in the beta UI. Existing installations that saved the Railway URL must replace it with the Worker URL or clear app data before testing the new default.

## 5. Retire Railway safely

Keep Railway as a rollback target for at least 48 hours after the Cloudflare-enabled beta reaches testers. Compare health, registrations and sandbox balances. Existing Redis data is not automatically copied into D1; migrate any real test records deliberately before shutdown. Once the new deployment passes and required records are confirmed, stop the Railway service before cancelling its plan.

Never delete the Railway project first: shutdown is the final step, not the migration method.
