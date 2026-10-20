-- Durable opt-in consent audit for MARS-X Network.
-- Append-only decisions; current state remains on network_accounts for fast reads.
-- No bandwidth sharing, provider SDK or payment execution is enabled here.
BEGIN;

CREATE TABLE IF NOT EXISTS network_consent_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES network_accounts(user_id),
  idempotency_key TEXT NOT NULL UNIQUE,
  consent_version TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('granted','revoked')),
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(btrim(consent_version)) > 0)
);

CREATE INDEX IF NOT EXISTS network_consent_user_time
  ON network_consent_events(user_id, occurred_at, event_id);

CREATE OR REPLACE FUNCTION network_guard_consent_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'network_consent_events_append_only';
END;
$$;

DROP TRIGGER IF EXISTS network_consent_events_append_only
  ON network_consent_events;
CREATE TRIGGER network_consent_events_append_only
  BEFORE UPDATE OR DELETE ON network_consent_events
  FOR EACH ROW EXECUTE FUNCTION network_guard_consent_append_only();

COMMIT;
