-- Make org_id nullable to allow permanent demo cameras
ALTER TABLE public.ip_cameras ALTER COLUMN org_id DROP NOT NULL;

-- Insert the permanent TP-Link TC73 camera
INSERT INTO public.ip_cameras (
  org_id,
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
  NULL,  -- org_id is NULL for permanent demo cameras
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