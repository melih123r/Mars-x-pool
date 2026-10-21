-- Optimize payout reconciliation and audit-consistency lookups.
-- This is an internal FIAT entitlement index only; it performs no payout or provider call.
BEGIN;

CREATE INDEX IF NOT EXISTS network_payout_audit_request_kind
  ON network_payout_audit(request_id,event_kind,event_key);

COMMIT;
