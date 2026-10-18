BEGIN;

CREATE OR REPLACE FUNCTION marsx_finance.record_ingest_event(
  p_ingest_event_id text,
  p_provider_account_id text,
  p_stream_kind text,
  p_source_event_key text,
  p_payload_sha256 text,
  p_source_time timestamptz
)
RETURNS TABLE(ingest_event_id text, inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id text;
  existing_digest text;
  existing_source_time timestamptz;
BEGIN
  INSERT INTO marsx_finance.ingest_events (
    ingest_event_id,
    provider_account_id,
    stream_kind,
    source_event_key,
    payload_sha256,
    source_time
  ) VALUES (
    p_ingest_event_id,
    p_provider_account_id,
    p_stream_kind,
    p_source_event_key,
    p_payload_sha256,
    p_source_time
  )
  ON CONFLICT (provider_account_id, stream_kind, source_event_key) DO NOTHING
  RETURNING marsx_finance.ingest_events.ingest_event_id
    INTO existing_id;

  IF FOUND THEN
    ingest_event_id := existing_id;
    inserted := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT e.ingest_event_id, e.payload_sha256, e.source_time
    INTO existing_id, existing_digest, existing_source_time
    FROM marsx_finance.ingest_events e
   WHERE e.provider_account_id = p_provider_account_id
     AND e.stream_kind = p_stream_kind
     AND e.source_event_key = p_source_event_key
   FOR SHARE;

  IF existing_id IS NULL THEN
    RAISE EXCEPTION 'finance_ingest_retry_not_visible' USING ERRCODE = '40001';
  END IF;

  IF existing_id IS DISTINCT FROM p_ingest_event_id
     OR existing_digest IS DISTINCT FROM p_payload_sha256
     OR existing_source_time IS DISTINCT FROM p_source_time THEN
    RAISE EXCEPTION 'finance_ingest_idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  ingest_event_id := existing_id;
  inserted := false;
  RETURN NEXT;
END;
$$;

COMMIT;
