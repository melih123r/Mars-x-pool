BEGIN;

CREATE TABLE marsx_finance.schema_migrations (
  version integer PRIMARY KEY CHECK (version BETWEEN 1 AND 9999),
  migration_name text NOT NULL UNIQUE
    CHECK (migration_name ~ '^[0-9]{3}_[a-z0-9_]+[.]sql$'),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION marsx_finance.register_schema_migration(
  p_version integer,
  p_migration_name text,
  p_sha256 text
)
RETURNS TABLE(inserted boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  current_name text;
  current_sha256 text;
BEGIN
  INSERT INTO marsx_finance.schema_migrations(version, migration_name, sha256)
  VALUES (p_version, p_migration_name, p_sha256)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    inserted := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT m.migration_name, m.sha256
    INTO current_name, current_sha256
    FROM marsx_finance.schema_migrations m
   WHERE m.version = p_version
   FOR SHARE;

  IF current_name IS NULL THEN
    RAISE EXCEPTION 'finance_migration_name_conflict' USING ERRCODE = '23505';
  END IF;

  IF current_name IS DISTINCT FROM p_migration_name
     OR current_sha256 IS DISTINCT FROM p_sha256 THEN
    RAISE EXCEPTION 'finance_migration_checksum_conflict' USING ERRCODE = '23505';
  END IF;

  inserted := false;
  RETURN NEXT;
END;
$$;

COMMIT;
