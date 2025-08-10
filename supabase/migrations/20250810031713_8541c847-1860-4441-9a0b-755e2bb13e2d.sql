alter table public.app_config enable row level security;

-- Create/replace policies idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_select_auth'
  ) THEN
    EXECUTE 'CREATE POLICY app_config_select_auth ON public.app_config FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_write_admin'
  ) THEN
    EXECUTE 'CREATE POLICY app_config_write_admin ON public.app_config FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;