BEGIN;

CREATE OR REPLACE FUNCTION marsx_network_demo.record_test_receipt(
  p_receipt_id text,
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
  current_status text;
  current_version text;
  existing_id text;
  existing_points integer;
  existing_kind text;
  existing_version text;
  existing_time timestamptz;
BEGIN
  SELECT d.consent_status, d.consent_version
    INTO current_status, current_version
    FROM marsx_network_demo.mock_devices d
   WHERE d.mock_device_id = p_mock_device_id
   FOR KEY SHARE;

  IF current_status IS DISTINCT FROM 'GRANTED'
     OR current_version IS DISTINCT FROM p_consent_version THEN
    RAISE EXCEPTION 'network_consent_required_for_receipt' USING ERRCODE = '23514';
  END IF;

  INSERT INTO marsx_network_demo.test_point_receipts (
    receipt_id,
    mock_device_id,
    idempotency_key,
    points,
    receipt_kind,
    consent_version,
    recorded_at
  ) VALUES (
    p_receipt_id,
    p_mock_device_id,
    p_idempotency_key,
    p_points,
    p_receipt_kind,
    p_consent_version,
    p_recorded_at
  )
  ON CONFLICT (mock_device_id, idempotency_key) DO NOTHING
  RETURNING marsx_network_demo.test_point_receipts.receipt_id
    INTO existing_id;

  IF FOUND THEN
    receipt_id := existing_id;
    inserted := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT r.receipt_id, r.points, r.receipt_kind, r.consent_version, r.recorded_at
    INTO existing_id, existing_points, existing_kind, existing_version, existing_time
    FROM marsx_network_demo.test_point_receipts r
   WHERE r.mock_device_id = p_mock_device_id
     AND r.idempotency_key = p_idempotency_key
   FOR SHARE;

  IF existing_id IS NULL THEN
    RAISE EXCEPTION 'network_receipt_retry_not_visible' USING ERRCODE = '40001';
  END IF;

  IF existing_id IS DISTINCT FROM p_receipt_id
     OR existing_points IS DISTINCT FROM p_points
     OR existing_kind IS DISTINCT FROM p_receipt_kind
     OR existing_version IS DISTINCT FROM p_consent_version
     OR existing_time IS DISTINCT FROM p_recorded_at THEN
    RAISE EXCEPTION 'network_receipt_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  receipt_id := existing_id;
  inserted := false;
  RETURN NEXT;
END;
$$;

COMMIT;
