-- MARS-X Network pending fiat entitlement upgrade.
-- Pending rows are accounting expectations only, never crypto or withdrawable funds.
BEGIN;

CREATE TABLE IF NOT EXISTS network_pending_receipts (
  transaction_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  partner_id TEXT NOT NULL,
  partner_reference TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD')),
  expected_settled_minor BIGINT NOT NULL CHECK (expected_settled_minor > 0),
  platform_minor BIGINT NOT NULL CHECK (platform_minor >= 0),
  users_minor BIGINT NOT NULL CHECK (users_minor >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','settled','rejected')),
  settled_receipt_id TEXT UNIQUE REFERENCES network_revenue_receipts(receipt_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (platform_minor + users_minor = expected_settled_minor),
  CHECK (platform_minor = expected_settled_minor / 5),
  CHECK ((status = 'settled') = (settled_receipt_id IS NOT NULL)),
  UNIQUE(partner_id,partner_reference)
);

CREATE TABLE IF NOT EXISTS network_pending_allocations (
  transaction_id TEXT NOT NULL
    REFERENCES network_pending_receipts(transaction_id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES network_accounts(user_id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  PRIMARY KEY(transaction_id,user_id)
);

CREATE INDEX IF NOT EXISTS network_pending_allocations_user
  ON network_pending_allocations(user_id,transaction_id);

CREATE OR REPLACE FUNCTION network_guard_pending_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
     OR NEW.partner_reference IS DISTINCT FROM OLD.partner_reference
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.expected_settled_minor IS DISTINCT FROM OLD.expected_settled_minor
     OR NEW.platform_minor IS DISTINCT FROM OLD.platform_minor
     OR NEW.users_minor IS DISTINCT FROM OLD.users_minor THEN
    RAISE EXCEPTION 'network_pending_identity_immutable';
  END IF;
  IF OLD.status IN ('settled','rejected')
     AND (NEW.status IS DISTINCT FROM OLD.status
       OR NEW.settled_receipt_id IS DISTINCT FROM OLD.settled_receipt_id) THEN
    RAISE EXCEPTION 'network_pending_terminal_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS network_pending_identity_immutable ON network_pending_receipts;
CREATE TRIGGER network_pending_identity_immutable
BEFORE UPDATE ON network_pending_receipts
FOR EACH ROW EXECUTE FUNCTION network_guard_pending_identity();

DROP TRIGGER IF EXISTS network_pending_receipts_no_delete ON network_pending_receipts;
CREATE TRIGGER network_pending_receipts_no_delete
BEFORE DELETE ON network_pending_receipts
FOR EACH ROW EXECUTE FUNCTION network_reject_immutable_change();

DROP TRIGGER IF EXISTS network_pending_allocations_immutable ON network_pending_allocations;
CREATE TRIGGER network_pending_allocations_immutable
BEFORE UPDATE OR DELETE ON network_pending_allocations
FOR EACH ROW EXECUTE FUNCTION network_reject_immutable_change();

COMMIT;
