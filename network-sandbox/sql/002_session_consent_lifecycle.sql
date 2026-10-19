BEGIN;

CREATE TABLE marsx_network_demo.mock_sessions (
  session_id text PRIMARY KEY CHECK (session_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  mock_device_id text NOT NULL
    REFERENCES marsx_network_demo.mock_devices(mock_device_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  session_status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (session_status IN ('ACTIVE','CLOSED','REVOKED')),
  consent_version text NOT NULL
    CHECK (octet_length(consent_version) BETWEEN 1 AND 64),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (session_status = 'ACTIVE' AND ended_at IS NULL) OR
    (session_status IN ('CLOSED','REVOKED') AND ended_at IS NOT NULL AND ended_at >= started_at)
  ),
  UNIQUE (mock_device_id, idempotency_key)
);

CREATE TABLE marsx_network_demo.consent_events (
  consent_event_id text PRIMARY KEY
    CHECK (consent_event_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  mock_device_id text NOT NULL
    REFERENCES marsx_network_demo.mock_devices(mock_device_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  event_kind text NOT NULL CHECK (event_kind IN ('GRANTED','REVOKED')),
  consent_version text NOT NULL
    CHECK (octet_length(consent_version) BETWEEN 1 AND 64),
  event_time timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mock_device_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION marsx_network_demo.reject_consent_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'network_consent_events_are_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER network_consent_event_immutable
BEFORE UPDATE OR DELETE ON marsx_network_demo.consent_events
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.reject_consent_event_mutation();

CREATE OR REPLACE FUNCTION marsx_network_demo.require_active_consent_for_receipt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status text;
  current_version text;
BEGIN
  SELECT consent_status, consent_version
    INTO current_status, current_version
    FROM marsx_network_demo.mock_devices
   WHERE mock_device_id = NEW.mock_device_id
   FOR KEY SHARE;

  IF current_status IS DISTINCT FROM 'GRANTED'
     OR current_version IS DISTINCT FROM NEW.consent_version THEN
    RAISE EXCEPTION 'network_consent_required_for_receipt' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER network_receipt_requires_active_consent
BEFORE INSERT ON marsx_network_demo.test_point_receipts
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.require_active_consent_for_receipt();

CREATE INDEX network_mock_sessions_device_time_idx
  ON marsx_network_demo.mock_sessions(mock_device_id, started_at DESC);
CREATE INDEX network_consent_events_device_time_idx
  ON marsx_network_demo.consent_events(mock_device_id, event_time DESC);

COMMIT;
