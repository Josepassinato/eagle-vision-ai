-- Create ip_cameras table used by edge function ip-camera-manager
CREATE TABLE IF NOT EXISTS public.ip_cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID DEFAULT current_org(),
  is_permanent BOOLEAN DEFAULT false,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  ip_address TEXT NOT NULL,
  port INTEGER DEFAULT 554,
  username TEXT,
  password TEXT,
  rtsp_path TEXT,
  http_port INTEGER DEFAULT 80,
  onvif_port INTEGER DEFAULT 80,
  status TEXT DEFAULT 'configured',
  last_tested_at TIMESTAMPTZ,
  stream_urls JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ip_cameras ENABLE ROW LEVEL SECURITY;

-- Policies: org isolation with public read for is_permanent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ip_cameras' AND policyname = 'ip_cameras_select'
  ) THEN
    CREATE POLICY ip_cameras_select
    ON public.ip_cameras
    FOR SELECT
    USING (org_id = current_org() OR is_permanent IS TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ip_cameras' AND policyname = 'ip_cameras_insert'
  ) THEN
    CREATE POLICY ip_cameras_insert
    ON public.ip_cameras
    FOR INSERT
    WITH CHECK (org_id = current_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ip_cameras' AND policyname = 'ip_cameras_update'
  ) THEN
    CREATE POLICY ip_cameras_update
    ON public.ip_cameras
    FOR UPDATE
    USING (org_id = current_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ip_cameras' AND policyname = 'ip_cameras_delete'
  ) THEN
    CREATE POLICY ip_cameras_delete
    ON public.ip_cameras
    FOR DELETE
    USING (org_id = current_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ip_cameras' AND policyname = 'service_role_ip_cameras'
  ) THEN
    CREATE POLICY service_role_ip_cameras
    ON public.ip_cameras
    FOR ALL
    USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
  END IF;
END $$;

-- Update trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_ip_cameras_updated_at'
  ) THEN
    CREATE TRIGGER update_ip_cameras_updated_at
    BEFORE UPDATE ON public.ip_cameras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ip_cameras_org_created ON public.ip_cameras (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_cameras_is_permanent ON public.ip_cameras (is_permanent);
