# Supabase zero-cost deployment

Verified on 28 September 2026 for the existing `MARS-X` project in the Paris region.

## Cost guard

- Organization plan: Free (`$0/month`).
- Do not upgrade the organization, enable a paid compute size, custom domain or paid add-on without the owner's explicit approval.
- Current published Free limits include 500 MB database storage, 5 GB egress and 500,000 Edge Function invocations. A Free project may pause after one week without activity.
- A limit or provider-policy change is an availability event, not permission to enable billing automatically.

## Live endpoint

```text
https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api
```

The API code is in `supabase/functions/marsx-pool-api/`. The PostgreSQL migrations are in `supabase/migrations/`. The compatibility layer preserves the existing D1-backed API behavior while storing data in the private `marsx_pool` schema.

## Security model

- `marsx_pool` is not exposed to client roles.
- Row-level security is enabled on every table and explicit deny policies cover `anon` and `authenticated`.
- Runtime credentials and licence configuration are read from Supabase Vault.
- Never commit a Worker token, admin token, licence pepper, session secret, licence records, Qonversion secret or Google OAuth credential.
- The public Edge Function disables Supabase JWT verification because it implements MARS-X's own licence, user-session and operator-token authentication. Public `/health` and `/privacy` routes are intentional.

## Required Vault names

```text
marsx_pool_worker_token
marsx_pool_admin_token
marsx_pool_license_pepper
marsx_pool_license_session_secret
marsx_pool_license_records_json
marsx_pool_auth_subject_pepper
marsx_pool_qonversion_secret_key        # when available
marsx_pool_google_web_client_id         # when available
```

## Release gate

Before removing Railway or publishing the Android bundle, verify all of the following against Supabase:

1. `/health` returns HTTP 200 with `ok=true`, `service=marsx-pool-worker-api`, `storage=postgres` and `persistent=true`.
2. A private tester licence activates and remains bound to one installation.
3. Register, heartbeat, account, sandbox credit and idempotent payout/refund work.
4. Google nonce, ID-token exchange, referral lock and account deletion work after the real Google Web client ID is installed.
5. Qonversion entitlement exchange works after the real server key is installed.
6. Security and performance advisors show no new actionable warning caused by `marsx_pool`.

Railway stays available only as rollback until this gate passes. It can then be deleted before any Railway paid period begins.
