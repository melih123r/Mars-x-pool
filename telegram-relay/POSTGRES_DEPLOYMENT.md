# PostgreSQL Telegram intake deployment gate

PR #70 is merged and the ten-lane relay code is deployed, but PostgreSQL dispatch is still opt-in. Do not enable this mode without a database migration, verified backups, and a private connection.

## Required configuration

- `MARSX_DISPATCH_MODE=postgres`
- `DATABASE_URL`: Render internal PostgreSQL connection string for a least-privilege role with access only to `marsx_telegram`.
- `MARSX_MESSAGE_ENCRYPTION_KEY`: independently generated 32-byte key encoded as 64 hexadecimal characters. Store only in Render secrets; never commit it.
- Optional `MARSX_OUTBOX_ENABLED=true`: polls pending result events every 30 seconds. Enable only after migration, worker execution, and single-instance configuration have been verified.
- Optional `MARSX_RECOVERY_ENABLED=true`: recovers expired worker leases every 60 seconds. Enable only after database migration and verified lease semantics.
- `GET /ready` returns HTTP 503 when Telegram credentials are missing or, in PostgreSQL mode, the database connection or schema is unavailable. `/health` is process liveness only; it does **not** establish production readiness.
- `GET /ready` reporting `agents_connected: false` is intentional until actual lane workers have been connected and verified.
- Existing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_ALLOWED_USER_ID` remain required.

Apply `telegram-relay/sql/001_durable_queue.sql` once using an authorized database administrator connection. The initial schema already allows lanes 1–10. For an existing older five-lane schema, use `telegram-relay/sql/002_upgrade_to_10_lanes.sql` after a backup. Do not expose PostgreSQL publicly just to run the migration.

### Verified production status (2026-10-13)

- Render relay deploy `cdfa24d77a1c10164773f21f7c2cfa1f09f98cda` is live, and the latest reviewed GitHub CI checks passed.
- Existing Render PostgreSQL is available in Frankfurt. Its external IP allowlist is empty; the hosted connector cannot inspect or migrate it. Keep it private and use Render's internal connection or an authorized private operator.
- Database migration, internal `DATABASE_URL`, encryption secret, and real AI worker integrations have not been independently verified. Do not turn on PostgreSQL mode until the schema is present; the service would otherwise fail readiness.
- The free PostgreSQL instance expires on 2026-11-05; migrate or upgrade storage before then.
- Validation order: backup → schema → internal connection and encryption secret → `/ready` → authorized Telegram ten-task intake → worker claim/ack → outbox result delivery → rollback verification.


## Operational limitations

The webhook now supports durable encrypted ten-lane intake when explicitly enabled. It does **not** start any lane worker, access existing ChatGPT consumer conversations, or produce completion events by itself. A separately enabled outbox polling loop can deliver events that real workers have already recorded. Worker processing, database permissions and end-to-end verification remain release blockers. Outbox polling and lease recovery exist as opt-in loops but do not execute real AI agents. Do not claim the feature is live merely because unit tests pass.

Outbox claim leases reduce concurrent duplicate sends, but Telegram `sendMessage` cannot guarantee exactly-once delivery after a process crash between send and acknowledgement.
