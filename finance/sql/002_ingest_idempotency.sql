BEGIN;

CREATE TABLE marsx_finance.ingest_events (
  ingest_event_id text PRIMARY KEY
    CHECK (ingest_event_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  provider_account_id text NOT NULL
    REFERENCES marsx_finance.provider_accounts(provider_account_id),
  stream_kind text NOT NULL CHECK (stream_kind IN ('PORTFOLIO','QUOTE','TEST_ORDER')),
  source_event_key text NOT NULL
    CHECK (octet_length(source_event_key) BETWEEN 16 AND 128),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  source_time timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_account_id, stream_kind, source_event_key)
);

CREATE OR REPLACE FUNCTION marsx_finance.reject_ingest_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'finance_ingest_events_are_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER finance_ingest_event_immutable
BEFORE UPDATE OR DELETE ON marsx_finance.ingest_events
FOR EACH ROW EXECUTE FUNCTION marsx_finance.reject_ingest_event_mutation();

CREATE INDEX finance_ingest_events_account_time_idx
  ON marsx_finance.ingest_events(provider_account_id, source_time DESC);

COMMIT;
