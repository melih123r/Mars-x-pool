-- MARS-X Telegram durable queue schema (PostgreSQL 18).
-- Apply ONLY after confirming database ownership, backup, and dedicated restricted DB role.
-- Does not execute ChatGPT conversations or authorize financial transactions.
BEGIN;
CREATE SCHEMA IF NOT EXISTS marsx_telegram;
CREATE TABLE IF NOT EXISTS marsx_telegram.intakes (
  update_id BIGINT PRIMARY KEY CHECK (update_id >= 0),
  payload_ciphertext BYTEA NOT NULL CHECK (octet_length(payload_ciphertext) BETWEEN 1 AND 65536),
  encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version > 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS marsx_telegram.tasks (
  task_id TEXT PRIMARY KEY,
  update_id BIGINT NOT NULL REFERENCES marsx_telegram.intakes(update_id) ON DELETE RESTRICT,
  lane SMALLINT NOT NULL CHECK (lane BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','claimed','running','succeeded','failed','not_configured')),
  worker_id TEXT,
  lease_until TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (update_id, lane),
  CHECK ((status IN ('claimed','running') AND worker_id IS NOT NULL AND lease_until IS NOT NULL)
      OR (status NOT IN ('claimed','running') AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS marsx_telegram_tasks_claimable
  ON marsx_telegram.tasks(lane, updated_at, task_id) WHERE status = 'queued' AND attempt_count < 20;
CREATE INDEX IF NOT EXISTS marsx_telegram_tasks_expired
  ON marsx_telegram.tasks(lease_until) WHERE status IN ('claimed','running');
CREATE TABLE IF NOT EXISTS marsx_telegram.outbox (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  update_id BIGINT NOT NULL REFERENCES marsx_telegram.intakes(update_id),
  event_kind TEXT NOT NULL CHECK (event_kind IN ('completed','failed')),
  delivered_at TIMESTAMPTZ,
  claim_token UUID,
  claim_until TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(update_id,event_kind)
);
CREATE INDEX IF NOT EXISTS marsx_telegram_outbox_pending
  ON marsx_telegram.outbox(event_id) WHERE delivered_at IS NULL AND attempt_count < 20;
COMMIT;
