-- ============================================
-- SETUP DEMO ORGANIZATION & DATA
-- Execute este script após as migrações para
-- configurar organização demo e dados iniciais
-- ============================================

-- 1. Criar organização demo
INSERT INTO orgs (name, plan) VALUES ('Demo Organization', 'starter') 
ON CONFLICT DO NOTHING
RETURNING id;

-- Note: Copie o ID retornado e substitua <ORG_ID> abaixo

-- 2. Configurar quotas (substitua <ORG_ID> pelo ID da org criada)
-- INSERT INTO quotas (org_id, max_streams, max_storage_gb, max_minutes_month) 
-- VALUES ('<ORG_ID>', 4, 20, 5000);

-- 3. Gerar API Key (substitua <ORG_ID> pelo ID da org criada)
-- INSERT INTO org_api_keys (org_id, name, secret) 
-- VALUES ('<ORG_ID>', 'demo-key', encode(gen_random_bytes(32), 'hex'))
-- RETURNING secret;

-- 4. Configurar políticas de retenção
-- INSERT INTO retention_policies (org_id, data_type, retention_days, auto_delete)
-- VALUES 
--   ('<ORG_ID>', 'clips', 30, true),
--   ('<ORG_ID>', 'metrics', 365, true),
--   ('<ORG_ID>', 'events', 90, true);

-- 5. Configurar privacidade
-- INSERT INTO privacy_settings (org_id, compliance_framework, face_blur_enabled, license_plate_blur_enabled)
-- VALUES ('<ORG_ID>', 'LGPD', false, false);

-- 6. Dados demo - fontes de stream
INSERT INTO demo_sources (name, analytic, protocol, url, location, confidence, active) VALUES
  ('YT People Demo', 'people_count', 'RTSP', 'rtsp://localhost:8554/yt_people', 'YouTube - People Counting', 60, true),
  ('YT Vehicle Demo', 'vehicle_detection', 'RTSP', 'rtsp://localhost:8554/yt_vehicles', 'YouTube - Vehicle Detection', 65, true),
  ('YT Safety Demo', 'safety_monitoring', 'RTSP', 'rtsp://localhost:8554/yt_safety', 'YouTube - Safety Monitoring', 70, true),
  ('YT Classroom Demo', 'edu_behavior', 'RTSP', 'rtsp://localhost:8554/yt_classroom', 'YouTube - Educational Analytics', 55, true)
ON CONFLICT (name) DO UPDATE SET
  url = EXCLUDED.url,
  active = EXCLUDED.active,
  confidence = EXCLUDED.confidence;

-- 7. Verificar dados criados
SELECT 'Demo Sources Created:' as status;
SELECT name, analytic, protocol, active FROM demo_sources ORDER BY created_at DESC;

SELECT 'Organizations:' as status;
SELECT id, name, plan FROM orgs;

-- 8. Configuração de câmeras demo (execute após ter ORG_ID)
-- INSERT INTO cameras (id, name, org_id, online, stream_url) VALUES
--   ('yt_people_demo', 'YouTube People Counter', '<ORG_ID>', true, 'rtsp://localhost:8554/yt_people'),
--   ('yt_vehicles_demo', 'YouTube Vehicle Detection', '<ORG_ID>', true, 'rtsp://localhost:8554/yt_vehicles'),
--   ('yt_safety_demo', 'YouTube Safety Monitor', '<ORG_ID>', true, 'rtsp://localhost:8554/yt_safety'),
--   ('yt_classroom_demo', 'YouTube Classroom Analytics', '<ORG_ID>', true, 'rtsp://localhost:8554/yt_classroom');

-- 9. Configurações de câmera
-- INSERT INTO camera_configs (camera_id, person_threshold, vehicle_threshold) VALUES
--   ('yt_people_demo', 0.6, 0.7),
--   ('yt_vehicles_demo', 0.7, 0.8),
--   ('yt_safety_demo', 0.65, 0.75),
--   ('yt_classroom_demo', 0.55, 0.65);

-- ============================================
-- INSTRUÇÕES MANUAIS:
-- 1. Execute este script
-- 2. Copie o ORG_ID retornado
-- 3. Descomente e execute as seções comentadas
--    substituindo <ORG_ID> pelo valor real
-- 4. Configure as chaves no Supabase Secrets:
--    - STRIPE_SECRET_KEY
--    - TELEGRAM_BOT_TOKEN
-- ============================================