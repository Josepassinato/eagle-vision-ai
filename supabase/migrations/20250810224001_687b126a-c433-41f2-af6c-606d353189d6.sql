-- Add streams table for managing active video streams
CREATE TABLE public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  analytic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_url TEXT,
  rtmp_url TEXT,
  hls_url TEXT,
  worker_id TEXT,
  pod_name TEXT,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- RLS policies for streams
CREATE POLICY "streams_isolated" ON public.streams
FOR ALL
USING (org_id = current_org());

CREATE POLICY "service_role_full_access_streams" ON public.streams
FOR ALL
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_streams_updated_at
  BEFORE UPDATE ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add usage_events table for tracking usage
CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for usage_events
CREATE POLICY "usage_events_isolated" ON public.usage_events
FOR ALL
USING (org_id = current_org());

CREATE POLICY "service_role_full_access_usage_events" ON public.usage_events
FOR ALL
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Add function to generate API keys
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  key_prefix TEXT := 'ak_';
  random_part TEXT;
BEGIN
  -- Generate a random 32-character string
  random_part := encode(gen_random_bytes(24), 'base64');
  -- Remove padding and make URL-safe
  random_part := replace(replace(random_part, '+', ''), '/', '');
  random_part := replace(random_part, '=', '');
  
  RETURN key_prefix || random_part;
END;
$$;