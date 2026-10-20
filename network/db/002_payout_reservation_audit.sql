-- MARS-X Network payout reservation/audit upgrade.
-- Backwards compatible with 001: existing ledger and payout rows are preserved.
-- This migration stores FIAT entitlements only. It performs no crypto transfer.
BEGIN;

ALTER TABLE network_payout_requests
  ADD COLUMN IF NOT EXISTS reservation_entry_id TEXT REFERENCES network_ledger_entries(entry_id),
  ADD COLUMN IF NOT EXISTS release_entry_id TEXT REFERENCES network_ledger_entries(entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS network_payout_reservation_entry_unique
  ON network_payout_requests(reservation_entry_id)
  WHERE reservation_entry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS network_payout_release_entry_unique
  ON network_payout_requests(release_entry_id)
  WHERE release_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS network_payout_audit (
  audit_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES network_payout_requests(request_id),
  event_key TEXT NOT NULL UNIQUE,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('reserved','released','settled','failed')),
  actor_kind TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_kind IN ('system','approved_partner','operator')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS network_payout_audit_request_time
  ON network_payout_audit(request_id,created_at);

CREATE OR REPLACE FUNCTION network_reject_immutable_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'network_immutable_record';
END;
$$;

DROP TRIGGER IF EXISTS network_ledger_entries_immutable ON network_ledger_entries;
CREATE TRIGGER network_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON network_ledger_entries
FOR EACH ROW EXECUTE FUNCTION network_reject_immutable_change();

DROP TRIGGER IF EXISTS network_payout_audit_immutable ON network_payout_audit;
CREATE TRIGGER network_payout_audit_immutable
BEFORE UPDATE OR DELETE ON network_payout_audit
FOR EACH ROW EXECUTE FUNCTION network_reject_immutable_change();

CREATE OR REPLACE FUNCTION network_guard_payout_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.asset IS DISTINCT FROM OLD.asset
     OR NEW.chain IS DISTINCT FROM OLD.chain
     OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
     OR NEW.reservation_entry_id IS DISTINCT FROM OLD.reservation_entry_id THEN
    RAISE EXCEPTION 'network_payout_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS network_payout_identity_immutable ON network_payout_requests;
CREATE TRIGGER network_payout_identity_immutable
BEFORE UPDATE ON network_payout_requests
FOR EACH ROW EXECUTE FUNCTION network_guard_payout_identity();

COMMIT;
