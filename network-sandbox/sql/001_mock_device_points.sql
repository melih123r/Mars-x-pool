BEGIN;

CREATE SCHEMA IF NOT EXISTS marsx_network_demo;

CREATE TABLE marsx_network_demo.mock_devices (
  mock_device_id text PRIMARY KEY
    CHECK (mock_device_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  device_ref_hash text NOT NULL UNIQUE CHECK (device_ref_hash ~ '^[a-f0-9]{64}$'),
  consent_status text NOT NULL CHECK (consent_status IN ('GRANTED','REVOKED')),
  consent_version text NOT NULL
    CHECK (octet_length(consent_version) BETWEEN 1 AND 64),
  consented_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (consent_status = 'GRANTED' AND revoked_at IS NULL) OR
    (consent_status = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_at >= consented_at)
  )
);

CREATE TABLE marsx_network_demo.test_point_receipts (
  receipt_id text PRIMARY KEY CHECK (receipt_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  mock_device_id text NOT NULL
    REFERENCES marsx_network_demo.mock_devices(mock_device_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  ledger_mode text NOT NULL DEFAULT 'TEST_ONLY' CHECK (ledger_mode = 'TEST_ONLY'),
  points integer NOT NULL CHECK (points BETWEEN 0 AND 1000),
  monetary_value numeric NOT NULL DEFAULT 0 CHECK (monetary_value = 0),
  receipt_kind text NOT NULL CHECK (receipt_kind IN ('MOCK_HEARTBEAT','MOCK_RESPONSE')),
  consent_version text NOT NULL
    CHECK (octet_length(consent_version) BETWEEN 1 AND 64),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mock_device_id, idempotency_key)
);

CREATE OR REPLACE FUNCTION marsx_network_demo.reject_test_receipt_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'network_test_receipts_are_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER network_test_receipt_immutable
BEFORE UPDATE OR DELETE ON marsx_network_demo.test_point_receipts
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.reject_test_receipt_mutation();

CREATE INDEX network_test_receipts_device_time_idx
  ON marsx_network_demo.test_point_receipts(mock_device_id, recorded_at DESC);

COMMIT;
