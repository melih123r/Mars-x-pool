BEGIN;

ALTER TABLE marsx_network_demo.mock_sessions
  ADD COLUMN terminal_session_event_id text
    REFERENCES marsx_network_demo.session_events(session_event_id);

CREATE INDEX network_sessions_terminal_event
  ON marsx_network_demo.mock_sessions(terminal_session_event_id)
  WHERE terminal_session_event_id IS NOT NULL;

ALTER FUNCTION marsx_network_demo.close_mock_session(
  text, text, text, timestamptz
) RENAME TO close_mock_session_v6;

CREATE OR REPLACE FUNCTION marsx_network_demo.close_mock_session(
  p_session_event_id text,
  p_session_id text,
  p_idempotency_key text,
  p_event_time timestamptz
)
RETURNS TABLE(session_event_id text, inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  persisted_event_id text;
  event_inserted boolean;
  linked_event_id text;
BEGIN
  SELECT t.session_event_id, t.inserted
    INTO persisted_event_id, event_inserted
    FROM marsx_network_demo.close_mock_session_v6(
      p_session_event_id, p_session_id, p_idempotency_key, p_event_time
    ) t;

  UPDATE marsx_network_demo.mock_sessions
     SET terminal_session_event_id = persisted_event_id
   WHERE session_id = p_session_id
     AND session_status = 'CLOSED'
     AND (terminal_session_event_id IS NULL OR terminal_session_event_id = persisted_event_id)
  RETURNING terminal_session_event_id INTO linked_event_id;

  IF linked_event_id IS DISTINCT FROM persisted_event_id THEN
    RAISE EXCEPTION 'network_session_terminal_event_conflict' USING ERRCODE = '23505';
  END IF;

  session_event_id := persisted_event_id;
  inserted := event_inserted;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION marsx_network_demo.record_consent_transition(
  text, text, text, text, text, timestamptz
) RENAME TO record_consent_transition_v7;

CREATE OR REPLACE FUNCTION marsx_network_demo.record_consent_transition(
  p_consent_event_id text,
  p_mock_device_id text,
  p_idempotency_key text,
  p_event_kind text,
  p_consent_version text,
  p_event_time timestamptz
)
RETURNS TABLE(consent_event_id text, inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  persisted_event_id text;
  event_inserted boolean;
BEGIN
  SELECT t.consent_event_id, t.inserted
    INTO persisted_event_id, event_inserted
    FROM marsx_network_demo.record_consent_transition_v7(
      p_consent_event_id, p_mock_device_id, p_idempotency_key,
      p_event_kind, p_consent_version, p_event_time
    ) t;

  IF p_event_kind = 'REVOKED' THEN
    UPDATE marsx_network_demo.mock_sessions s
       SET terminal_session_event_id = e.session_event_id
      FROM marsx_network_demo.session_events e
     WHERE s.mock_device_id = p_mock_device_id
       AND s.session_status = 'REVOKED'
       AND e.session_id = s.session_id
       AND e.consent_event_id = persisted_event_id
       AND (s.terminal_session_event_id IS NULL OR s.terminal_session_event_id = e.session_event_id);
  END IF;

  consent_event_id := persisted_event_id;
  inserted := event_inserted;
  RETURN NEXT;
END;
$$;

COMMIT;
