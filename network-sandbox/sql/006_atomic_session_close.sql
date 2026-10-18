BEGIN;

CREATE TABLE marsx_network_demo.session_events (
  session_event_id text PRIMARY KEY
    CHECK (session_event_id ~ '^[a-zA-Z0-9_-]{16,128}$'),
  session_id text NOT NULL
    REFERENCES marsx_network_demo.mock_sessions(session_id),
  idempotency_key text NOT NULL
    CHECK (octet_length(idempotency_key) BETWEEN 16 AND 128),
  event_kind text NOT NULL CHECK (event_kind = 'CLOSED'),
  event_time timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key)
);

CREATE INDEX network_session_events_session_time_idx
  ON marsx_network_demo.session_events(session_id, event_time DESC);

CREATE OR REPLACE FUNCTION marsx_network_demo.reject_session_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'network_session_events_are_append_only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER network_session_event_immutable
BEFORE UPDATE OR DELETE ON marsx_network_demo.session_events
FOR EACH ROW EXECUTE FUNCTION marsx_network_demo.reject_session_event_mutation();

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
  current_status text;
  current_started_at timestamptz;
  persisted_event_id text;
BEGIN
  SELECT s.session_status, s.started_at
    INTO current_status, current_started_at
    FROM marsx_network_demo.mock_sessions s
   WHERE s.session_id = p_session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'network_session_not_found' USING ERRCODE = '23503';
  END IF;
  IF p_event_time < current_started_at THEN
    RAISE EXCEPTION 'network_session_close_precedes_start' USING ERRCODE = '23514';
  END IF;

  INSERT INTO marsx_network_demo.session_events(
    session_event_id, session_id, idempotency_key, event_kind, event_time
  )
  VALUES (p_session_event_id, p_session_id, p_idempotency_key, 'CLOSED', p_event_time)
  ON CONFLICT (session_id, idempotency_key) DO NOTHING
  RETURNING marsx_network_demo.session_events.session_event_id
    INTO persisted_event_id;

  IF persisted_event_id IS NULL THEN
    SELECT e.session_event_id
      INTO persisted_event_id
      FROM marsx_network_demo.session_events e
     WHERE e.session_id = p_session_id
       AND e.idempotency_key = p_idempotency_key
     FOR SHARE;

    IF persisted_event_id IS DISTINCT FROM p_session_event_id THEN
      RAISE EXCEPTION 'network_session_event_idempotency_conflict' USING ERRCODE = '23505';
    END IF;

    session_event_id := persisted_event_id;
    inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'network_active_session_required_for_close' USING ERRCODE = '23514';
  END IF;

  UPDATE marsx_network_demo.mock_sessions
     SET session_status = 'CLOSED', ended_at = p_event_time
   WHERE mock_sessions.session_id = p_session_id;

  session_event_id := persisted_event_id;
  inserted := true;
  RETURN NEXT;
END;
$$;

COMMIT;
