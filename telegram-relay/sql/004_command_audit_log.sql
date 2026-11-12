BEGIN;

CREATE TABLE IF NOT EXISTS marsx_telegram.command_audit_log (
  audit_event_id TEXT PRIMARY KEY
    CHECK (audit_event_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  command_id TEXT NOT NULL
    REFERENCES marsx_telegram.command_inbox(command_id),
  event_key TEXT NOT NULL
    CHECK (octet_length(event_key) BETWEEN 16 AND 128),
  lane_number INTEGER NOT NULL CHECK (lane_number BETWEEN 1 AND 10),
  event_kind TEXT NOT NULL
    CHECK (event_kind IN ('RECEIVED','CLAIMED','RETRIED','COMPLETED','FAILED','BLOCKED')),
  actor_ref_hash TEXT CHECK (actor_ref_hash ~ '^[a-f0-9]{64}$'),
  error_code TEXT CHECK (error_code ~ '^[a-z0-9_]{1,64}$'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (octet_length(metadata::text) <= 16384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (command_id, event_key)
);

CREATE OR REPLACE FUNCTION marsx_telegram.reject_command_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'telegram_command_audit_is_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER telegram_command_audit_immutable
BEFORE UPDATE OR DELETE ON marsx_telegram.command_audit_log
FOR EACH ROW EXECUTE FUNCTION marsx_telegram.reject_command_audit_mutation();

CREATE INDEX IF NOT EXISTS marsx_telegram_command_audit_command_time
  ON marsx_telegram.command_audit_log(command_id, created_at DESC);

COMMIT;
