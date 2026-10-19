BEGIN;

CREATE OR REPLACE FUNCTION marsx_telegram.validate_command_recovery_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  command_status text;
  command_attempt_count integer;
  expected_event_kind text;
BEGIN
  IF NEW.error_code IS DISTINCT FROM 'lease_expired' THEN
    RETURN NEW;
  END IF;

  SELECT status, attempt_count
    INTO command_status, command_attempt_count
    FROM marsx_telegram.command_inbox
   WHERE command_id = NEW.command_id;

  expected_event_kind := CASE WHEN command_status = 'failed' THEN 'FAILED' ELSE 'RETRIED' END;
  IF command_status IS NULL
     OR command_status NOT IN ('pending','failed')
     OR NEW.event_kind IS DISTINCT FROM expected_event_kind
     OR NOT (NEW.metadata ? 'attemptCount')
     OR (NEW.metadata->>'attemptCount') !~ '^[0-9]+$'
     OR (NEW.metadata->>'attemptCount')::integer IS DISTINCT FROM command_attempt_count THEN
    RAISE EXCEPTION 'telegram_recovery_audit_state_mismatch' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER telegram_command_recovery_audit_guard
BEFORE INSERT ON marsx_telegram.command_audit_log
FOR EACH ROW EXECUTE FUNCTION marsx_telegram.validate_command_recovery_audit();

COMMIT;
