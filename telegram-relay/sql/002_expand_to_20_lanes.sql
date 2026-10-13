-- Optional capacity expansion; run only after 001_durable_queue.sql and a verified backup.
-- Capacity is not worker connectivity. Existing five-lane jobs remain unchanged.
BEGIN;
ALTER TABLE marsx_telegram.tasks
  DROP CONSTRAINT IF EXISTS tasks_lane_check;
ALTER TABLE marsx_telegram.tasks
  ADD CONSTRAINT tasks_lane_check CHECK (lane BETWEEN 1 AND 20);
COMMIT;
