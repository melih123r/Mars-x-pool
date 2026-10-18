BEGIN;

CREATE TABLE marsx_network_demo.receipt_session_links (
  receipt_id text PRIMARY KEY
    REFERENCES marsx_network_demo.test_point_receipts(receipt_id),
  session_id text NOT NULL
    REFERENCES marsx_network_demo.mock_sessions(session_id),
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX network_receipt_session_links_session_idx
  ON marsx_network_demo.receipt_session_links(session_id, linked_at DESC);

CREATE TRIGGER network_receipt_session_link_immutable
BEFORE UPDATE OR DELETE ON marsx_network_demo.receipt_session_links
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.reject_test_receipt_mutation();

CREATE OR REPLACE FUNCTION marsx_network_demo.record_session_receipt(
  p_receipt_id text,
  p_session_id text,
  p_mock_device_id text,
  p_idempotency_key text,
  p_points integer,
  p_receipt_kind text,
  p_consent_version text,
  p_recorded_at timestamptz
)
RETURNS TABLE(receipt_id text, inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  persisted_id text;
  receipt_inserted boolean;
  current_device_id text;
  current_session_status text;
  current_consent_version text;
  current_session_id text;
BEGIN
  SELECT r.receipt_id, r.inserted
    INTO persisted_id, receipt_inserted
    FROM marsx_network_demo.record_test_receipt(
      p_receipt_id,
      p_mock_device_id,
      p_idempotency_key,
      p_points,
      p_receipt_kind,
      p_consent_version,
      p_recorded_at
    ) r;

  SELECT s.mock_device_id, s.session_status, s.consent_version
    INTO current_device_id, current_session_status, current_consent_version
    FROM marsx_network_demo.mock_sessions s
   WHERE s.session_id = p_session_id
   FOR KEY SHARE;

  IF current_device_id IS DISTINCT FROM p_mock_device_id
     OR current_session_status IS DISTINCT FROM 'ACTIVE'
     OR current_consent_version IS DISTINCT FROM p_consent_version THEN
    RAISE EXCEPTION 'network_active_session_required_for_receipt' USING ERRCODE = '23514';
  END IF;

  INSERT INTO marsx_network_demo.receipt_session_links(receipt_id, session_id)
  VALUES (persisted_id, p_session_id)
  ON CONFLICT (receipt_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT l.session_id
      INTO current_session_id
      FROM marsx_network_demo.receipt_session_links l
     WHERE l.receipt_id = persisted_id
     FOR SHARE;

    IF current_session_id IS DISTINCT FROM p_session_id THEN
      RAISE EXCEPTION 'network_receipt_session_conflict' USING ERRCODE = '23505';
    END IF;
  END IF;

  receipt_id := persisted_id;
  inserted := receipt_inserted;
  RETURN NEXT;
END;
$$;

COMMIT;
