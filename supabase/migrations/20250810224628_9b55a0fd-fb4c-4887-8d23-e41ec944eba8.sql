-- Create edge_devices table for managing edge appliances
CREATE TABLE public.edge_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'edge_appliance',
  location TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  linked_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  ip_address TEXT,
  version TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edge_devices ENABLE ROW LEVEL SECURITY;

-- RLS policies for edge_devices
CREATE POLICY "edge_devices_isolated" ON public.edge_devices
FOR ALL
USING (org_id = current_org());

CREATE POLICY "service_role_full_access_edge_devices" ON public.edge_devices
FOR ALL
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_edge_devices_updated_at
  BEFORE UPDATE ON public.edge_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create edge_clips table for on-demand clip uploads
CREATE TABLE public.edge_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.edge_devices(id) ON DELETE CASCADE,
  camera_id TEXT,
  clip_path TEXT NOT NULL,
  clip_url TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  upload_requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edge_clips ENABLE ROW LEVEL SECURITY;

-- RLS policies for edge_clips
CREATE POLICY "edge_clips_isolated" ON public.edge_clips
FOR ALL
USING (org_id = current_org());

CREATE POLICY "service_role_full_access_edge_clips" ON public.edge_clips
FOR ALL
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');