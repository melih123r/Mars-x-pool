-- Defense-in-depth consent gate for payout reservation rows.
-- Backwards compatible: existing rows are preserved and only future INSERTs are checked.
-- Fiat reservation only; no transfer, conversion, signing or provider call.
BEGIN;

CREATE OR REPLACE FUNCTION network_require_active_consent_for_payout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  account_consent_at TIMESTAMPTZ;
  account_revoked_at TIMESTAMPTZ;
BEGIN
  SELECT consent_at, revoked_at
    INTO account_consent_at, account_revoked_at
    FROM network_accounts
   WHERE user_id = NEW.user_id;

  IF account_consent_at IS NULL OR account_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'network_active_consent_required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS network_payout_active_consent
  ON network_payout_requests;
CREATE TRIGGER network_payout_active_consent
  BEFORE INSERT ON network_payout_requests
  FOR EACH ROW EXECUTE FUNCTION network_require_active_consent_for_payout();

COMMIT;
