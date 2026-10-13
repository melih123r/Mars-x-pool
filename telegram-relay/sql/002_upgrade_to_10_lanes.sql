-- Upgrade an existing five-lane MARS-X Telegram task table to ten lanes.
-- Apply after 001_durable_queue.sql and a database backup, before enabling
-- MARSX_DISPATCH_MODE=postgres. Does not start workers or enable trading.
BEGIN;
DO $migration$
DECLARE
  constraint_oid oid;
  constraint_def text;
BEGIN
  IF to_regclass('marsx_telegram.tasks') IS NULL THEN
    RAISE EXCEPTION 'marsx_telegram.tasks missing: apply 001_durable_queue.sql first';
  END IF;
  SELECT c.oid, pg_get_constraintdef(c.oid)
    INTO constraint_oid, constraint_def
    FROM pg_constraint c
   WHERE c.conrelid = 'marsx_telegram.tasks'::regclass
     AND c.conname = 'tasks_lane_check'
     AND c.contype = 'c';
  IF constraint_oid IS NOT NULL THEN
    IF constraint_def NOT LIKE '%lane%' THEN
      RAISE EXCEPTION 'Unexpected tasks_lane_check definition: %', constraint_def;
    END IF;
    ALTER TABLE marsx_telegram.tasks DROP CONSTRAINT tasks_lane_check;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'marsx_telegram.tasks'::regclass
       AND conname = 'tasks_lane_1_to_10_check'
  ) THEN
    ALTER TABLE marsx_telegram.tasks
      ADD CONSTRAINT tasks_lane_1_to_10_check CHECK (lane BETWEEN 1 AND 10);
  END IF;
END;
$migration$;
COMMIT;
