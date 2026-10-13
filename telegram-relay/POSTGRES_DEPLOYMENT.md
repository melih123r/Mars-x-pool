# PostgreSQL Telegram intake deployment gate

The live Render bot continues to run in its existing mode until the draft PR is reviewed and merged. Do not enable this mode without a database migration and verified backups.

## Required configuration

- `MARSX_DISPATCH_MODE=postgres`
- `DATABASE_URL`: Render internal PostgreSQL connection string for a least-privilege role with access only to `marsx_telegram`.
- `MARSX_MESSAGE_ENCRYPTION_KEY`: independently generated 32-byte key encoded as 64 hexadecimal characters. Store only in Render secrets; never commit it.
- Optional `MARSX_OUTBOX_ENABLED=true`: polls pending result events every 30 seconds. Enable only after migration, worker execution, and single-instance configuration have been verified.
- Existing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_ALLOWED_USER_ID` remain required.

Apply `telegram-relay/sql/001_durable_queue.sql` once using an authorized database administrator connection. Do not expose PostgreSQL publicly just to run the migration.

## Operational limitations

The webhook now supports durable encrypted five-lane intake when explicitly enabled. It does **not** start any lane worker, access existing ChatGPT consumer conversations, or produce completion events by itself. A separately enabled outbox polling loop can deliver events that real workers have already recorded. Worker processing, event generation, outbox scheduler, database permissions and end-to-end verification remain release blockers. Do not claim the feature is live merely because unit tests pass.

Outbox claim leases reduce concurrent duplicate sends, but Telegram `sendMessage` cannot guarantee exactly-once delivery after a process crash between send and acknowledgement.
