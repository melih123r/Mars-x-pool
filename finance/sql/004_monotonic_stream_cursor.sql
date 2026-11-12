BEGIN;

CREATE TABLE marsx_finance.stream_cursors (
  provider_account_id text NOT NULL
    REFERENCES marsx_finance.provider_accounts(provider_account_id),
  stream_kind text NOT NULL
    CHECK (stream_kind IN ('PORTFOLIO','QUOTE','TEST_ORDER')),
  last_sequence bigint NOT NULL CHECK (last_sequence >= 0),
  source_event_key text NOT NULL
    CHECK (octet_length(source_event_key) BETWEEN 16 AND 128),
  payload_sha256 text NOT NULL
    CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_account_id, stream_kind)
);

CREATE OR REPLACE FUNCTION marsx_finance.advance_stream_cursor(
  p_provider_account_id text,
  p_stream_kind text,
  p_sequence bigint,
  p_source_event_key text,
  p_payload_sha256 text
)
RETURNS TABLE(advanced boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  current_sequence bigint;
  current_event_key text;
  current_digest text;
BEGIN
  INSERT INTO marsx_finance.stream_cursors (
    provider_account_id,
    stream_kind,
    last_sequence,
    source_event_key,
    payload_sha256
  ) VALUES (
    p_provider_account_id,
    p_stream_kind,
    p_sequence,
    p_source_event_key,
    p_payload_sha256
  )
  ON CONFLICT (provider_account_id, stream_kind) DO NOTHING;

  IF FOUND THEN
    advanced := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT c.last_sequence, c.source_event_key, c.payload_sha256
    INTO current_sequence, current_event_key, current_digest
    FROM marsx_finance.stream_cursors c
   WHERE c.provider_account_id = p_provider_account_id
     AND c.stream_kind = p_stream_kind
   FOR UPDATE;

  IF p_sequence < current_sequence THEN
    RAISE EXCEPTION 'finance_stream_cursor_regression' USING ERRCODE = '23514';
  END IF;

  IF p_sequence = current_sequence THEN
    IF current_event_key IS DISTINCT FROM p_source_event_key
       OR current_digest IS DISTINCT FROM p_payload_sha256 THEN
      RAISE EXCEPTION 'finance_stream_cursor_conflict' USING ERRCODE = '23505';
    END IF;
    advanced := false;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE marsx_finance.stream_cursors
     SET last_sequence = p_sequence,
         source_event_key = p_source_event_key,
         payload_sha256 = p_payload_sha256,
         updated_at = now()
   WHERE provider_account_id = p_provider_account_id
     AND stream_kind = p_stream_kind;

  advanced := true;
  RETURN NEXT;
END;
$$;

COMMIT;
