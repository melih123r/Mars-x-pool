BEGIN;
CREATE TABLE IF NOT EXISTS marsx_telegram.command_inbox (
  command_id TEXT PRIMARY KEY CHECK (command_id ~ '^telegram-[0-9]+-(chat|task)$'),
  update_id BIGINT NOT NULL UNIQUE CHECK (update_id >= 0),
  command_kind TEXT NOT NULL CHECK (command_kind IN ('chat','task')),
  project TEXT NOT NULL CHECK (project ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  payload_ciphertext BYTEA NOT NULL CHECK (octet_length(payload_ciphertext) BETWEEN 1 AND 65536),
  encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','claimed','completed','failed','blocked')),
  worker_id TEXT,
  lease_until TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code TEXT CHECK (last_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status='claimed' AND worker_id IS NOT NULL AND lease_until IS NOT NULL)
      OR (status<>'claimed' AND worker_id IS NULL AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS marsx_telegram_command_inbox_claimable
  ON marsx_telegram.command_inbox(retry_at,created_at,command_id)
  WHERE status='pending' AND attempt_count < 10;
COMMIT;
