-- Add missing columns to existing ip_cameras table
ALTER TABLE public.ip_cameras 
ADD COLUMN IF NOT EXISTS network_mask TEXT,
ADD COLUMN IF NOT EXISTS gateway TEXT,
ADD COLUMN IF NOT EXISTS dns_server TEXT,
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT false;

-- Insert the permanent TP-Link TC73 camera if it doesn't exist
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
) 
SELECT 
  'TP-Link TC73 - Câmera de Teste',
  'tp-link',
  'TC73',
  '172.16.100.22'::inet,
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.ip_cameras 
  WHERE ip_address = '172.16.100.22'::inet 
  AND model = 'TC73'
);