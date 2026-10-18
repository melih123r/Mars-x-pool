BEGIN;

ALTER TABLE marsx_network_demo.session_events
  DROP CONSTRAINT session_events_event_kind_check;

ALTER TABLE marsx_network_demo.session_events
  ADD CONSTRAINT session_events_event_kind_check
    CHECK (event_kind IN ('CLOSED','REVOKED')),
  ADD COLUMN consent_event_id text
    REFERENCES marsx_network_demo.consent_events(consent_event_id);

CREATE UNIQUE INDEX network_session_events_consent_session_unique
  ON marsx_network_demo.session_events(consent_event_id, session_id)
  WHERE consent_event_id IS NOT NULL;

ALTER FUNCTION marsx_network_demo.record_consent_transition(
  text, text, text, text, text, timestamptz
) RENAME TO record_consent_transition_v3;

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
    FROM marsx_network_demo.record_consent_transition_v3(
      p_consent_event_id,
      p_mock_device_id,
      p_idempotency_key,
      p_event_kind,
      p_consent_version,
      p_event_time
    ) t;

  IF event_inserted AND p_event_kind = 'REVOKED' THEN
    INSERT INTO marsx_network_demo.session_events (
      session_event_id,
      session_id,
      idempotency_key,
      event_kind,
      event_time,
      consent_event_id
    )
    SELECT
      'revoke_' || md5(p_consent_event_id || ':' || s.session_id),
      s.session_id,
      'consent_revoke_' || md5(p_consent_event_id || ':' || s.session_id),
      'REVOKED',
      p_event_time,
      p_consent_event_id
    FROM marsx_network_demo.mock_sessions s
    WHERE s.mock_device_id = p_mock_device_id
      AND s.session_status = 'REVOKED'
      AND s.ended_at = p_event_time
    ON CONFLICT DO NOTHING;
  END IF;

  consent_event_id := persisted_event_id;
  inserted := event_inserted;
  RETURN NEXT;
END;
$$;

COMMIT;
