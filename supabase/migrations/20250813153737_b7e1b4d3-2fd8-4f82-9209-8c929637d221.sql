-- Create IP cameras functionality for real connections
CREATE TABLE public.ip_cameras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  brand text,
  model text,
  ip_address inet NOT NULL,
  port integer NOT NULL DEFAULT 80,
  username text,
  password text,
  rtsp_path text,
  http_port integer DEFAULT 80,
  onvif_port integer DEFAULT 80,
  status text NOT NULL DEFAULT 'pending',
  last_tested_at timestamp with time zone,
  stream_urls jsonb DEFAULT '{}',
  capabilities jsonb DEFAULT '{}',
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ip_cameras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "ip_cameras_isolated" 
ON public.ip_cameras 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_ip_cameras" 
ON public.ip_cameras 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add trigger for updated_at
CREATE TRIGGER update_ip_cameras_updated_at
BEFORE UPDATE ON public.ip_cameras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_ip_cameras_org_id ON public.ip_cameras(org_id);
CREATE INDEX idx_ip_cameras_status ON public.ip_cameras(status);
CREATE INDEX idx_ip_cameras_ip_address ON public.ip_cameras(ip_address);