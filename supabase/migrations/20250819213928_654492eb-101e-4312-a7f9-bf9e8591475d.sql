-- Create ip_cameras table for storing permanent camera configurations
CREATE TABLE IF NOT EXISTS public.ip_cameras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  ip_address INET NOT NULL,
  port INTEGER DEFAULT 554,
  username TEXT,
  password TEXT,
  rtsp_path TEXT,
  http_port INTEGER DEFAULT 80,
  onvif_port INTEGER DEFAULT 80,
  network_mask TEXT,
  gateway TEXT,
  dns_server TEXT,
  status TEXT DEFAULT 'offline',
  last_tested_at TIMESTAMP WITH TIME ZONE,
  stream_urls JSONB DEFAULT '{}',
  error_message TEXT,
  is_permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ip_cameras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view IP cameras in their org" 
ON public.ip_cameras 
FOR SELECT 
USING (org_id = auth.uid() OR org_id IS NULL);

CREATE POLICY "Users can manage IP cameras in their org" 
ON public.ip_cameras 
FOR ALL 
USING (org_id = auth.uid() OR org_id IS NULL)
WITH CHECK (org_id = auth.uid() OR org_id IS NULL);

CREATE POLICY "Service role can manage all IP cameras" 
ON public.ip_cameras 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Insert the permanent TP-Link TC73 camera
INSERT INTO public.ip_cameras (
  name,
  brand,
  model,
  ip_address,
  port,
  username,
  password,
  rtsp_path,
  http_port,
  onvif_port,
  network_mask,
  gateway,
  dns_server,
  status,
  is_permanent
) VALUES (
  'TP-Link TC73 - Câmera de Teste',
  'tp-link',
  'TC73',
  '172.16.100.22',
  554,
  'admin',
  'admin',
  '/stream1',
  80,
  80,
  '255.255.255.0',
  '172.16.100.254',
  '8.8.8.8',
  'configured',
  true
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_ip_cameras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ip_cameras_updated_at
  BEFORE UPDATE ON public.ip_cameras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ip_cameras_updated_at();