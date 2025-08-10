-- Move pgcrypto extension to the recommended 'extensions' schema to satisfy linter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'
  ) THEN
    -- Supabase normally has this, but guard just in case
    EXECUTE 'CREATE SCHEMA extensions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname <> 'extensions'
  ) THEN
    -- If pgcrypto exists but is not in 'extensions', move it
    EXECUTE 'ALTER EXTENSION pgcrypto SET SCHEMA extensions';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    -- If not installed, install directly into 'extensions'
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions';
  END IF;
END$$;