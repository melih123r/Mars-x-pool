BEGIN;

CREATE OR REPLACE FUNCTION marsx_finance.record_ordered_ingest_event(
  p_ingest_event_id text,
  p_provider_account_id text,
  p_stream_kind text,
  p_sequence bigint,
  p_source_event_key text,
  p_payload_sha256 text,
  p_source_time timestamptz
)
RETURNS TABLE(ingest_event_id text, inserted boolean, cursor_advanced boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  persisted_ingest_event_id text;
  event_inserted boolean;
  stream_advanced boolean;
BEGIN
  SELECT c.advanced
    INTO stream_advanced
    FROM marsx_finance.advance_stream_cursor(
      p_provider_account_id,
      p_stream_kind,
      p_sequence,
      p_source_event_key,
      p_payload_sha256
    ) c;

  SELECT e.ingest_event_id, e.inserted
    INTO persisted_ingest_event_id, event_inserted
    FROM marsx_finance.record_ingest_event(
      p_ingest_event_id,
      p_provider_account_id,
      p_stream_kind,
      p_source_event_key,
      p_payload_sha256,
      p_source_time
    ) e;

  ingest_event_id := persisted_ingest_event_id;
  inserted := event_inserted;
  cursor_advanced := stream_advanced;
  RETURN NEXT;
END;
$$;

COMMIT;
