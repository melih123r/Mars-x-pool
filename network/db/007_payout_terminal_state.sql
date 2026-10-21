-- Guard payout state transitions and terminal audit consistency.
-- This migration changes internal FIAT entitlement accounting only.
-- It performs no provider call, transfer, signing, conversion or live payout.
BEGIN;

CREATE OR REPLACE FUNCTION network_guard_payout_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF OLD.provider_reference IS NOT NULL
       AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference THEN
      RAISE EXCEPTION 'network_payout_provider_reference_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('settled', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'network_payout_terminal_state_immutable';
  END IF;

  IF NOT (
    (OLD.status = 'blocked_partner_approval' AND NEW.status = 'reserved')
    OR (OLD.status = 'reserved' AND NEW.status IN ('submitted', 'failed', 'cancelled'))
    OR (OLD.status = 'submitted' AND NEW.status IN ('settled', 'failed'))
  ) THEN
    RAISE EXCEPTION 'network_invalid_payout_state_transition';
  END IF;

  IF OLD.provider_reference IS NOT NULL
     AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference THEN
    RAISE EXCEPTION 'network_payout_provider_reference_immutable';
  END IF;

  IF NEW.status IN ('submitted', 'settled')
     AND NEW.provider_reference IS NULL THEN
    RAISE EXCEPTION 'network_payout_provider_reference_required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS network_payout_state_transition
  ON network_payout_requests;
CREATE TRIGGER network_payout_state_transition
BEFORE UPDATE ON network_payout_requests
FOR EACH ROW EXECUTE FUNCTION network_guard_payout_state_transition();

CREATE OR REPLACE FUNCTION network_require_payout_terminal_records()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS network_payout_terminal_records
  ON network_payout_requests;
CREATE CONSTRAINT TRIGGER network_payout_terminal_records
AFTER INSERT OR UPDATE ON network_payout_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION network_require_payout_terminal_records();

COMMIT;
