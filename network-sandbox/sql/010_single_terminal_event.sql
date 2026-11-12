BEGIN;

CREATE UNIQUE INDEX network_session_events_single_terminal
  ON marsx_network_demo.session_events(session_id)
  WHERE event_kind IN ('CLOSED','REVOKED');

COMMIT;
