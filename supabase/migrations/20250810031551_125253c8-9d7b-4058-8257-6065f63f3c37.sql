-- Harden app_config with RLS and function search_path

-- Enable RLS
alter table if exists public.app_config enable row level security;

-- Policies: allow SELECT to authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_select_auth'
  ) THEN
    EXECUTE $$
      CREATE POLICY app_config_select_auth
      ON public.app_config
      FOR SELECT
      TO authenticated
      USING (true);
    $$;
  END IF;
END $$;

-- Policies: restrict writes to admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_write_admin'
  ) THEN
    EXECUTE $$
      CREATE POLICY app_config_write_admin
      ON public.app_config
      FOR ALL
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    $$;
  END IF;
END $$;

-- Recreate function with stable search_path
create or replace function public.get_media_retention_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value::int from public.app_config where key = 'MEDIA_RETENTION_DAYS'), 90);
$$;