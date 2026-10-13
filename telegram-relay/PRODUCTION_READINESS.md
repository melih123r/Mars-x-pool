# Telegram → MARS-X five-lane production readiness

## What works today

- Telegram's authenticated webhook reaches the existing Render relay.
- The production relay acknowledges a single authorized Telegram user.
- Proposed PR #70 can optionally create **metadata-only** GitHub issue records (one issue listing five lanes). It does not deliver message plaintext or execute workers.

## Do not claim

- GitHub issue creation is **not** five-way message delivery.
- The five existing ChatGPT consumer conversations cannot be addressed through a supported public ChatGPT conversation-write API.
- A GitHub search before issue creation is not an atomic exactly-once guarantee.
- An in-memory Set does not survive Render restarts.
- A successful GitHub workflow is not an end-to-end Telegram-to-worker test.

## Release blockers

1. Choose a durable, private storage service with atomic uniqueness on `(telegram_update_id)` and one child task per `(telegram_update_id, lane)`; never store private Telegram text in public GitHub issues.
2. Encrypt original text at rest; limit access to the five approved worker identities; configure expiration and deletion.
3. Implement an authenticated worker claim/ack API with task leases and idempotency keys. Distinguish `received`, `queued`, `claimed`, `running`, `succeeded`, `failed`, and `not_configured`.
4. Connect actual authorized executors for Android, UI, backend, finance, QA. No browser cookies or unsupported consumer-chat automation.
5. Persist a Telegram report outbox, with a unique report ID and explicit partial-failure handling. Telegram sendMessage and database commits cannot form a single atomic transaction; exactly-once external delivery cannot be guaranteed without downstream idempotency.
6. Verify the GitHub token uses minimum necessary permissions and remains only in Render secrets. Ensure any GitHub repository storing issue metadata is allowed by the user.
7. Exercise unauthorized sender, malformed payload, Unicode chunk boundaries, duplicate update, simultaneous retries, Render restart, downstream outage, worker failure, secret rotation, and recovery.
8. Merge only after tests pass and manually verify deployment logs plus a real Telegram command and a genuine worker execution receipt.

## Privacy and safety

- Current proposed GitHub issue contains a keyed HMAC and metadata, **not** the original message.
- The current webhook secret doubles as the HMAC key; use a separate `MARSX_MESSAGE_HMAC_KEY` in a future hardened deployment and rotate keys safely.
- Never automatically execute transfers, trades, withdrawals, or other irreversible finance actions without explicit approval.

## User-visible truthfulness

Report `five lanes registered` only after durable per-lane task records exist; report `five workers completed` only after five actual signed worker receipts exist. Otherwise say which lane is unconfigured or failed.
