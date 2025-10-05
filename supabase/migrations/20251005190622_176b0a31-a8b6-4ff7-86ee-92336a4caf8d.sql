-- Deletar todas as câmeras não permanentes
DELETE FROM ip_cameras WHERE is_permanent = false OR is_permanent IS NULL;

-- Atualizar a câmera permanente com a nova URL de teste
UPDATE ip_cameras 
SET 
  ip_address = '190.171.138.210',
  port = 554,
  name = 'Câmera de Teste RTSP - 190.171.138.210',
  stream_urls = jsonb_build_object('rtsp', 'rtsp://190.171.138.210/1'),
  status = 'online',
  username = '',
  password = '',
  rtsp_path = '/1',
  updated_at = now()
WHERE is_permanent = true;

-- Se não existir nenhuma câmera permanente, criar uma nova
INSERT INTO ip_cameras (
  id,
  name,
  ip_address,
  port,
  username,
  password,
  rtsp_path,
  stream_urls,
  brand,
  model,
  status,
  is_permanent,
  org_id
)
SELECT 
  gen_random_uuid(),
  'Câmera de Teste RTSP - 190.171.138.210',
  '190.171.138.210',
  554,
  '',
  '',
  '/1',
  jsonb_build_object('rtsp', 'rtsp://190.171.138.210/1'),
  'Generic',
  'RTSP Camera',
  'online',
  true,
  current_org()
WHERE NOT EXISTS (SELECT 1 FROM ip_cameras WHERE is_permanent = true);