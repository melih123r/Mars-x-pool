BEGIN;

CREATE OR REPLACE FUNCTION marsx_network_demo.record_consent_transition(
  p_consent_event_id text,
  p_mock_device_id text,
  p_idempotency_key text,
  p_event_kind text,
  p_consent_version text,
  p_event_time timestamptz
)
RETURNS TABLE(consent_event_id text, inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id text;
  existing_kind text;
  existing_version text;
  existing_time timestamptz;
BEGIN
  PERFORM 1
    FROM marsx_network_demo.mock_devices d
   WHERE d.mock_device_id = p_mock_device_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'network_mock_device_not_found' USING ERRCODE = '23503';
  END IF;

  INSERT INTO marsx_network_demo.consent_events (
    consent_event_id,
    mock_device_id,
    idempotency_key,
    event_kind,
    consent_version,
    event_time
  ) VALUES (
    p_consent_event_id,
    p_mock_device_id,
    p_idempotency_key,
    p_event_kind,
    p_consent_version,
    p_event_time
  )
  ON CONFLICT (mock_device_id, idempotency_key) DO NOTHING
  RETURNING marsx_network_demo.consent_events.consent_event_id
    INTO existing_id;

  IF NOT FOUND THEN
    SELECT e.consent_event_id, e.event_kind, e.consent_version, e.event_time
      INTO existing_id, existing_kind, existing_version, existing_time
      FROM marsx_network_demo.consent_events e
     WHERE e.mock_device_id = p_mock_device_id
       AND e.idempotency_key = p_idempotency_key
     FOR SHARE;

    IF existing_id IS NULL THEN
      RAISE EXCEPTION 'network_consent_retry_not_visible' USING ERRCODE = '40001';
    END IF;
    IF existing_id IS DISTINCT FROM p_consent_event_id
       OR existing_kind IS DISTINCT FROM p_event_kind
       OR existing_version IS DISTINCT FROM p_consent_version
       OR existing_time IS DISTINCT FROM p_event_time THEN
      RAISE EXCEPTION 'network_consent_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    consent_event_id := existing_id;
    inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_event_kind = 'REVOKED' THEN
    UPDATE marsx_network_demo.mock_devices
       SET consent_status = 'REVOKED',
           consent_version = p_consent_version,
           revoked_at = p_event_time,
           updated_at = now()
     WHERE mock_device_id = p_mock_device_id;

    UPDATE marsx_network_demo.mock_sessions
       SET session_status = 'REVOKED',
           ended_at = p_event_time
     WHERE mock_device_id = p_mock_device_id
       AND session_status = 'ACTIVE';
  ELSIF p_event_kind = 'GRANTED' THEN
    UPDATE marsx_network_demo.mock_devices
       SET consent_status = 'GRANTED',
           consent_version = p_consent_version,
           consented_at = p_event_time,
           revoked_at = NULL,
           updated_at = now()
     WHERE mock_device_id = p_mock_device_id;
  ELSE
    RAISE EXCEPTION 'network_invalid_consent_event_kind' USING ERRCODE = '23514';
  END IF;

  consent_event_id := existing_id;
  inserted := true;
  RETURN NEXT;
END;
$$;

COMMIT;
