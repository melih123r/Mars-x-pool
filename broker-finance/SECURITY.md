# Security

Do not commit Railway variables, raw licence keys, Android signing keys, Play Console credentials or service-account files.

Report vulnerabilities privately through GitHub's security reporting interface when available. Never include live credentials, licence keys or personal data in a public issue.

## Secret separation

- `WORKER_TOKEN` is operator-only and protects worker-list/summary routes.
- `ADMIN_TOKEN` is a separate operator secret for sandbox credits, payout status changes and dormant-account sweeps.
- `LICENSE_PEPPER` hashes customer keys at rest.
- `LICENSE_SESSION_SECRET` signs expiring device-bound sessions.
- All four values must be different, randomly generated and at least 32 characters where specified.

Rotate a secret immediately after exposure. Revoking a licence means changing its record status to `revoked` in `LICENSE_RECORDS_JSON` and redeploying. Device bindings persist in the private Redis service.

## Production hardening

Before paid launch, add Play Integrity verification, backend Play Billing purchase verification, an operator revocation/reset tool, encrypted backups, retention jobs, monitoring, incident response and release signing through Play App Signing. Keep sensitive entitlement logic on the backend. Do not convert `USDT_TEST` into a real transferable asset without legal review and regulated payment/custody controls.
