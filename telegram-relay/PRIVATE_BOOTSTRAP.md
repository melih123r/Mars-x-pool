# One-time private database setup

This operator command fills the free-plan Shell gap. It does not run on normal
startup, enable dispatch, connect AI workers, or send Telegram messages.

Before production use, obtain approval to give the relay temporary access to the
existing database administrator connection and create the restricted role
`marsx_telegram_relay`. Keep the external database allowlist closed.

The command only accepts the existing Render internal database host and database.
It refuses any existing Telegram schema or role instead of changing them. All
creation and permission checks run in one transaction. It never changes Pool
tables or PUBLIC privileges on existing tables. If inherited PUBLIC grants expose
unrelated tables or sequences to the new role, it rolls back for operator review.

1. Verify CI's PostgreSQL 18 bootstrap test passes, including rollback, denied
   access to unrelated data, concurrent intake deduplication and ten terminal
   `not_configured` task states. This is not a production Telegram delivery test.
2. After approval, place the internal administrator URL in
   `MARSX_SETUP_DATABASE_URL` through Render's secret editor. Generate a separate
   32-byte random hexadecimal password as `MARSX_RELAY_DB_PASSWORD`. Set
   `MARSX_BOOTSTRAP_APPROVED=create_isolated_telegram_schema`.
3. Run `node telegram-relay/bootstrap-private-db.mjs` on Render's private network.
   On the free web instance, an explicitly approved single deploy can use
   `node telegram-relay/bootstrap-private-db.mjs && node telegram-relay/server.mjs`
   as its temporary start command. Existing metadata mode stays selected.
4. Confirm the non-secret success record in logs. Restore the original start
   command and remove the three setup variables before enabling runtime dispatch.
   Store a runtime `DATABASE_URL` using the same internal host/database but the
   new restricted username and password. Never put either URL in output or git.
5. Generate an independent AES key in `MARSX_MESSAGE_ENCRYPTION_KEY`, then test
   readiness and intake before enabling outbox or recovery. Real workers remain
   a separate release gate; this setup alone does not complete the ten-agent MVP.

The role can select, insert and update Telegram tables and use their identity
sequence. It cannot delete rows, modify unrelated tables or perform schema changes.
The migration owner retains administrative access. This does not provide isolation
from a database administrator or from arbitrary publicly executable database
functions; audit any existing custom functions before accepting untrusted workers.

The existing free database expires in November 2026. This setup adds no paid
resources and does not extend that expiry or provide a long-term backup plan.
