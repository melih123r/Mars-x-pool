BEGIN;

CREATE OR REPLACE FUNCTION marsx_network_demo.validate_terminal_session_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status text;
  current_event_id text;
  event_matches boolean;
BEGIN
  SELECT session_status, terminal_session_event_id
    INTO current_status, current_event_id
    FROM marsx_network_demo.mock_sessions
   WHERE session_id = NEW.session_id;

  IF current_status = 'ACTIVE' THEN
    IF current_event_id IS NOT NULL THEN
      RAISE EXCEPTION 'network_active_session_cannot_have_terminal_event' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF current_event_id IS NULL THEN
    RAISE EXCEPTION 'network_terminal_session_event_required' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM marsx_network_demo.session_events e
     WHERE e.session_event_id = current_event_id
       AND e.session_id = NEW.session_id
       AND e.event_kind = current_status
  ) INTO event_matches;

  IF NOT event_matches THEN
    RAISE EXCEPTION 'network_terminal_session_event_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER network_terminal_session_event_integrity
AFTER INSERT OR UPDATE OF session_status, terminal_session_event_id
ON marsx_network_demo.mock_sessions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.validate_terminal_session_event();

COMMIT;
