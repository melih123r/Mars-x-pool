BEGIN;

CREATE SCHEMA IF NOT EXISTS marsx_finance;

CREATE TABLE marsx_finance.provider_accounts (
  provider_account_id text PRIMARY KEY
    CHECK (provider_account_id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{2,32}$'),
  account_ref_hash text NOT NULL CHECK (account_ref_hash ~ '^[a-f0-9]{64}$'),
  access_mode text NOT NULL CHECK (access_mode IN ('READ_ONLY','PAPER')),
  kyc_status text NOT NULL CHECK
    (kyc_status IN ('UNKNOWN','NOT_REQUIRED','PENDING','VERIFIED','REJECTED','EXPIRED')),
  aml_status text NOT NULL CHECK
    (aml_status IN ('UNKNOWN','PENDING','CLEAR','REVIEW','BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, account_ref_hash)
);

CREATE TABLE marsx_finance.portfolio_snapshots (
  snapshot_id text PRIMARY KEY CHECK (snapshot_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  provider_account_id text NOT NULL
    REFERENCES marsx_finance.provider_accounts(provider_account_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  as_of timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 1048576),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_account_id, idempotency_key)
);

CREATE TABLE marsx_finance.quotes (
  quote_id text PRIMARY KEY CHECK (quote_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  provider_account_id text NOT NULL
    REFERENCES marsx_finance.provider_accounts(provider_account_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9][A-Z0-9._:/-]{0,31}$'),
  bid numeric(38,18) CHECK (bid IS NULL OR bid >= 0),
  ask numeric(38,18) CHECK (ask IS NULL OR ask >= 0),
  last_price numeric(38,18) CHECK (last_price IS NULL OR last_price >= 0),
  source_time timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (octet_length(payload::text) <= 1048576),
  received_at timestamptz NOT NULL DEFAULT now(),
  CHECK (bid IS NOT NULL OR ask IS NOT NULL OR last_price IS NOT NULL),
  CHECK (bid IS NULL OR ask IS NULL OR bid <= ask),
  CHECK (expires_at >= source_time),
  UNIQUE (provider_account_id, idempotency_key)
);

CREATE TABLE marsx_finance.test_orders (
  test_order_id text PRIMARY KEY CHECK (test_order_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  provider_account_id text NOT NULL
    REFERENCES marsx_finance.provider_accounts(provider_account_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  execution_mode text NOT NULL DEFAULT 'TEST_ONLY' CHECK (execution_mode = 'TEST_ONLY'),
  is_executable boolean NOT NULL DEFAULT false CHECK (is_executable = false),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9][A-Z0-9._:/-]{0,31}$'),
  side text NOT NULL CHECK (side IN ('BUY','SELL')),
  order_type text NOT NULL CHECK (order_type IN ('MARKET','LIMIT','STOP','STOP_LIMIT')),
  quantity numeric(38,18) NOT NULL CHECK (quantity > 0),
  limit_price numeric(38,18) CHECK (limit_price IS NULL OR limit_price > 0),
  status text NOT NULL DEFAULT 'RECORDED' CHECK
    (status IN ('RECORDED','VALIDATED','REJECTED','CANCELLED')),
  kyc_status_at_submit text NOT NULL CHECK
    (kyc_status_at_submit IN ('UNKNOWN','NOT_REQUIRED','PENDING','VERIFIED','REJECTED','EXPIRED')),
  aml_status_at_submit text NOT NULL CHECK
    (aml_status_at_submit IN ('UNKNOWN','PENDING','CLEAR','REVIEW','BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_account_id, idempotency_key)
);

CREATE TABLE marsx_finance.audit_log (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text NOT NULL UNIQUE CHECK (event_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  actor_ref_hash text NOT NULL CHECK (actor_ref_hash ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK (action ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  object_type text NOT NULL CHECK (object_type ~ '^[a-z][a-z0-9_]{2,31}$'),
  object_id text NOT NULL CHECK (octet_length(object_id) BETWEEN 1 AND 128),
  outcome text NOT NULL CHECK (outcome IN ('ACCEPTED','REJECTED','FAILED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (octet_length(metadata::text) <= 65536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION marsx_finance.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'finance_audit_log_is_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER finance_audit_immutable
BEFORE UPDATE OR DELETE ON marsx_finance.audit_log
FOR EACH ROW EXECUTE FUNCTION marsx_finance.reject_audit_mutation();

CREATE INDEX portfolio_snapshots_account_time_idx
  ON marsx_finance.portfolio_snapshots(provider_account_id, as_of DESC);
CREATE INDEX quotes_symbol_time_idx
  ON marsx_finance.quotes(symbol, source_time DESC);
CREATE INDEX test_orders_account_time_idx
  ON marsx_finance.test_orders(provider_account_id, created_at DESC);
CREATE INDEX audit_log_object_time_idx
  ON marsx_finance.audit_log(object_type, object_id, created_at DESC);

COMMIT;
