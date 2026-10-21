-- Require an immutable audit event for each payout submission and terminal outcome.
-- This migration records FIAT entitlement workflow state only.
-- It performs no provider call, signing, conversion, transfer or live payout.
BEGIN;

ALTER TABLE network_payout_audit
  DROP CONSTRAINT IF EXISTS network_payout_audit_event_kind_check;

ALTER TABLE network_payout_audit
  ADD CONSTRAINT network_payout_audit_event_kind_check
  CHECK (event_kind IN ('reserved','released','submitted','settled','failed'));

CREATE OR REPLACE FUNCTION network_require_payout_terminal_records()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'submitted' AND NOT EXISTS (
    SELECT 1 FROM network_payout_audit audit
     WHERE audit.request_id = NEW.request_id
       AND audit.event_kind = 'submitted'
       AND audit.details->>'providerReference' = NEW.provider_reference
  ) THEN
    RAISE EXCEPTION 'network_payout_submitted_audit_required';
  END IF;

  IF NEW.status = 'settled' AND NOT EXISTS (
    SELECT 1 FROM network_payout_audit audit
     WHERE audit.request_id = NEW.request_id
       AND audit.event_kind = 'settled'
  ) THEN
    RAISE EXCEPTION 'network_payout_settled_audit_required';
  END IF;

  IF NEW.status = 'failed' AND NOT EXISTS (
    SELECT 1 FROM network_payout_audit audit
     WHERE audit.request_id = NEW.request_id
       AND audit.event_kind = 'failed'
  ) THEN
    RAISE EXCEPTION 'network_payout_failed_audit_required';
  END IF;

  IF NEW.status = 'cancelled' AND (
    NEW.release_entry_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM network_payout_audit audit
       WHERE audit.request_id = NEW.request_id
         AND audit.event_kind = 'released'
    )
  ) THEN
    RAISE EXCEPTION 'network_payout_cancelled_release_required';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
