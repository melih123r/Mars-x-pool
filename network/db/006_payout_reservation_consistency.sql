-- Deferred consistency gate for payout reservations.
-- Existing blocked_partner_approval rows remain compatible.
-- Reserved/submitted/settled rows must be backed by immutable fiat ledger and audit records.
-- No transfer, conversion, signing, provider call or live payout.
BEGIN;

CREATE OR REPLACE FUNCTION network_require_payout_reservation_records()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('reserved', 'submitted', 'settled') THEN
    IF NEW.reservation_entry_id IS NULL OR NOT EXISTS (
      SELECT 1
        FROM network_ledger_entries entry
       WHERE entry.entry_id = NEW.reservation_entry_id
         AND entry.user_id = NEW.user_id
         AND entry.currency = NEW.currency
         AND entry.entry_type = 'payout_reservation'
         AND entry.amount_minor = -NEW.amount_minor
    ) THEN
      RAISE EXCEPTION 'network_payout_reservation_ledger_required';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM network_payout_audit audit
       WHERE audit.request_id = NEW.request_id
         AND audit.event_kind = 'reserved'
    ) THEN
      RAISE EXCEPTION 'network_payout_reservation_audit_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS network_payout_reservation_records
  ON network_payout_requests;
CREATE CONSTRAINT TRIGGER network_payout_reservation_records
  AFTER INSERT OR UPDATE ON network_payout_requests
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION network_require_payout_reservation_records();

COMMIT;
