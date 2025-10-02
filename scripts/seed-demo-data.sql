-- Script de População de Dados Demo para Visão de Águia
-- Data: 2025-10-02
-- Objetivo: Popular banco com dados realistas para demonstração

-- ============================================
-- 1. PESSOAS DEMO (People)
-- ============================================

INSERT INTO public.people (id, name, metadata) VALUES
  ('00000000-0000-0000-0001-000000000001', 'João Silva', '{"type": "demo", "scenario": "retail", "role": "customer"}'),
  ('00000000-0000-0000-0001-000000000002', 'Maria Santos', '{"type": "demo", "scenario": "office", "role": "employee"}'),
  ('00000000-0000-0000-0001-000000000003', 'Pedro Costa', '{"type": "demo", "scenario": "industrial", "role": "worker"}'),
  ('00000000-0000-0000-0001-000000000004', 'Ana Oliveira', '{"type": "demo", "scenario": "retail", "role": "customer"}'),
  ('00000000-0000-0000-0001-000000000005', 'Carlos Ferreira', '{"type": "demo", "scenario": "office", "role": "manager"}'),
  ('00000000-0000-0000-0001-000000000006', 'Julia Rodrigues', '{"type": "demo", "scenario": "church", "role": "member"}'),
  ('00000000-0000-0000-0001-000000000007', 'Roberto Almeida', '{"type": "demo", "scenario": "industrial", "role": "supervisor"}'),
  ('00000000-0000-0000-0001-000000000008', 'Fernanda Lima', '{"type": "demo", "scenario": "retail", "role": "employee"}'),
  ('00000000-0000-0000-0001-000000000009', 'Marcos Pereira', '{"type": "demo", "scenario": "office", "role": "security"}'),
  ('00000000-0000-0000-0001-000000000010', 'Patricia Souza', '{"type": "demo", "scenario": "church", "role": "visitor"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. EVENTOS DEMO (Events)
-- ============================================

-- Eventos dos últimos 7 dias
INSERT INTO public.events (person_id, camera_id, reason, face_similarity, reid_similarity, frames_confirmed, movement_px, ts)
SELECT
  (ARRAY[
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0001-000000000003',
    '00000000-0000-0000-0001-000000000004',
    '00000000-0000-0000-0001-000000000005'
  ])[1 + floor(random() * 5)::int]::uuid,
  'camera_' || (1 + floor(random() * 5)::int),
  (ARRAY['face', 'movement', 'reid', 'tracking'])[1 + floor(random() * 4)::int],
  0.75 + (random() * 0.24),
  0.70 + (random() * 0.29),
  3 + floor(random() * 12)::int,
  10.0 + (random() * 90.0),
  now() - (interval '1 hour' * generate_series(0, 168))
FROM generate_series(1, 500);

-- ============================================
-- 3. DETECÇÕES DE VEÍCULOS DEMO (Vehicle Detections)
-- ============================================

INSERT INTO public.vehicle_detections (org_id, camera_id, plate_text, confidence, vehicle_type, color, bbox, detected_at)
SELECT
  (SELECT id FROM public.orgs LIMIT 1),
  'camera_entrada_' || (1 + floor(random() * 3)::int),
  (ARRAY[
    'ABC1234', 'DEF5678', 'GHI9012', 'JKL3456', 'MNO7890',
    'ABC1D23', 'DEF2E45', 'GHI3F67', 'JKL4G89', 'MNO5H12',
    'PQR6789', 'STU1234', 'VWX5678', 'YZA9012', 'BCD3456',
    'EFG1A23', 'HIJ2B45', 'KLM3C67', 'NOP4D89', 'QRS5E12'
  ])[1 + floor(random() * 20)::int],
  0.80 + (random() * 0.19),
  (ARRAY['car', 'truck', 'motorcycle', 'van', 'suv'])[1 + floor(random() * 5)::int],
  (ARRAY['white', 'black', 'silver', 'blue', 'red', 'gray'])[1 + floor(random() * 6)::int],
  jsonb_build_object(
    'x1', floor(random() * 100)::int,
    'y1', floor(random() * 100)::int,
    'x2', 200 + floor(random() * 100)::int,
    'y2', 150 + floor(random() * 50)::int
  ),
  now() - (interval '1 minute' * generate_series(0, 2000))
FROM generate_series(1, 200);

-- ============================================
-- 4. INCIDENTES ANTIFURTO DEMO (Antitheft Incidents)
-- ============================================

INSERT INTO public.antitheft_incidents (
  camera_id, person_id, track_id, first_ts, last_ts, 
  signals_count, severity, reason, metadata, clip_url, status
)
SELECT
  'camera_loja_' || (1 + floor(random() * 3)::int),
  (ARRAY[
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0001-000000000004',
    '00000000-0000-0000-0001-000000000008'
  ])[1 + floor(random() * 3)::int]::uuid,
  floor(random() * 10000)::int,
  ts,
  ts + interval '30 seconds' + (interval '1 second' * floor(random() * 120)),
  1 + floor(random() * 5)::int,
  (ARRAY['low', 'medium', 'high'])[1 + floor(random() * 3)::int],
  (ARRAY[
    'concealment_dwell',
    'shelf_out_movement', 
    'exit_grace_violation',
    'high_value_dwell'
  ])[1 + floor(random() * 4)::int],
  jsonb_build_object(
    'zone', (ARRAY['shelf', 'concealment', 'exit', 'high_value'])[1 + floor(random() * 4)::int],
    'confidence', 0.7 + (random() * 0.29)
  ),
  '/clips/demo_incident_' || floor(random() * 1000) || '.mp4',
  (ARRAY['pending_review', 'confirmed', 'false_positive'])[1 + floor(random() * 3)::int]
FROM (
  SELECT now() - (interval '1 hour' * generate_series(0, 168)) as ts
) AS times
LIMIT 50;

-- ============================================
-- 5. INCIDENTES EDUCACIONAIS DEMO (Edu Incidents)
-- ============================================

-- Criar classes primeiro (se não existir)
INSERT INTO public.edu_classes (id, name, location, metadata)
VALUES 
  ('00000000-0000-0000-0002-000000000001', 'Turma A - 3º Ano', 'Sala 101', '{"capacity": 30, "level": "elementary"}'),
  ('00000000-0000-0000-0002-000000000002', 'Turma B - 5º Ano', 'Sala 203', '{"capacity": 25, "level": "elementary"}'),
  ('00000000-0000-0000-0002-000000000003', 'Turma C - 7º Ano', 'Sala 305', '{"capacity": 32, "level": "middle"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.edu_incidents (
  class_id, student_id, first_ts, last_ts, 
  signals_count, severity, status, aggregation_key, notes
)
SELECT
  (ARRAY[
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0002-000000000003'
  ])[1 + floor(random() * 3)::int]::uuid,
  (ARRAY[
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0001-000000000003'
  ])[1 + floor(random() * 3)::int]::uuid,
  ts,
  ts + interval '5 minutes',
  1 + floor(random() * 3)::int,
  (ARRAY['low', 'medium', 'high'])[1 + floor(random() * 3)::int],
  (ARRAY['pending_review', 'reviewed', 'resolved'])[1 + floor(random() * 3)::int],
  'demo_agg_' || floor(random() * 100),
  (ARRAY[
    'Estudante distraído durante aula',
    'Comportamento inadequado identificado',
    'Necessita atenção especial',
    'Padrão de comportamento normal'
  ])[1 + floor(random() * 4)::int]
FROM (
  SELECT now() - (interval '1 day' * generate_series(0, 30)) as ts
) AS times
LIMIT 30;

-- ============================================
-- 6. SAFETY INCIDENTS DEMO
-- ============================================

-- Criar sites de segurança (se não existir)
INSERT INTO public.safety_sites (id, name, timezone)
VALUES
  ('00000000-0000-0000-0003-000000000001', 'Fábrica Norte', 'America/Sao_Paulo'),
  ('00000000-0000-0000-0003-000000000002', 'Armazém Sul', 'America/Sao_Paulo'),
  ('00000000-0000-0000-0003-000000000003', 'Depósito Central', 'America/Sao_Paulo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.safety_events (
  site_id, camera_id, event_type, severity, 
  person_id, metadata, detected_at, resolved_at, status
)
SELECT
  (ARRAY[
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0003-000000000003'
  ])[1 + floor(random() * 3)::int]::uuid,
  'camera_safety_' || (1 + floor(random() * 5)::int),
  (ARRAY['no_helmet', 'no_vest', 'fall_detected', 'restricted_area'])[1 + floor(random() * 4)::int],
  (ARRAY['low', 'medium', 'high', 'critical'])[1 + floor(random() * 4)::int],
  (ARRAY[
    '00000000-0000-0000-0001-000000000003',
    '00000000-0000-0000-0001-000000000007',
    NULL
  ])[1 + floor(random() * 3)::int]::uuid,
  jsonb_build_object(
    'confidence', 0.75 + (random() * 0.24),
    'ppe_detected', (ARRAY['helmet', 'vest', 'boots', 'none'])[1 + floor(random() * 4)::int]
  ),
  ts,
  CASE WHEN random() > 0.5 THEN ts + interval '15 minutes' ELSE NULL END,
  (ARRAY['active', 'acknowledged', 'resolved', 'false_positive'])[1 + floor(random() * 4)::int]
FROM (
  SELECT now() - (interval '1 hour' * generate_series(0, 168)) as ts
) AS times
LIMIT 80;

-- ============================================
-- 7. MÉTRICAS DE HEAT MAP DEMO
-- ============================================

INSERT INTO public.heat_map_data (
  org_id, camera_id, zone_coordinates, heat_intensity,
  movement_count, dwell_time_avg, time_bucket, data_type
)
SELECT
  (SELECT id FROM public.orgs LIMIT 1),
  'camera_retail_' || (1 + floor(random() * 4)::int),
  jsonb_build_object(
    'x', floor(random() * 500)::int,
    'y', floor(random() * 400)::int,
    'width', 50 + floor(random() * 100)::int,
    'height', 50 + floor(random() * 100)::int
  ),
  random() * 100,
  floor(random() * 50)::int,
  10.0 + (random() * 120.0),
  date_trunc('hour', ts),
  'movement'
FROM (
  SELECT now() - (interval '1 hour' * generate_series(0, 168)) as ts
) AS times
LIMIT 500;

-- ============================================
-- 8. EDGE CLIPS DEMO
-- ============================================

INSERT INTO public.edge_clips (
  org_id, camera_id, event_type, start_time, end_time,
  duration_seconds, file_size_mb, storage_path, checksum,
  privacy_applied, blur_faces, blur_plates, retention_days, upload_status
)
SELECT
  (SELECT id FROM public.orgs LIMIT 1),
  'camera_' || (1 + floor(random() * 5)::int),
  (ARRAY['antitheft', 'safety', 'general', 'security'])[1 + floor(random() * 4)::int],
  ts,
  ts + interval '30 seconds',
  30 + floor(random() * 30)::int,
  2.5 + (random() * 7.5),
  'clips/demo/' || extract(year from ts) || '/' || extract(month from ts) || '/clip_' || floor(random() * 10000) || '.mp4',
  md5(random()::text),
  random() > 0.3,
  random() > 0.5,
  random() > 0.5,
  30 + floor(random() * 60)::int,
  (ARRAY['completed', 'processing', 'failed'])[1 + floor(random() * 3)::int]
FROM (
  SELECT now() - (interval '1 hour' * generate_series(0, 168)) as ts
) AS times
LIMIT 100;

-- ============================================
-- 9. REAL TIME METRICS DEMO
-- ============================================

INSERT INTO public.real_time_metrics (
  org_id, metric_type, metric_name, value, camera_id, metadata
)
SELECT
  (SELECT id FROM public.orgs LIMIT 1),
  (ARRAY['detection', 'tracking', 'analytics'])[1 + floor(random() * 3)::int],
  (ARRAY['people_count', 'dwell_time', 'movement_speed', 'zone_occupancy'])[1 + floor(random() * 4)::int],
  random() * 100,
  'camera_' || (1 + floor(random() * 5)::int),
  jsonb_build_object(
    'confidence', 0.8 + (random() * 0.19),
    'source', 'yolo'
  )
FROM generate_series(1, 200);

-- ============================================
-- CONFIRMAÇÃO
-- ============================================

DO $$
DECLARE
  people_count INTEGER;
  events_count INTEGER;
  vehicles_count INTEGER;
  incidents_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO people_count FROM public.people WHERE name LIKE '%Silva%' OR name LIKE '%Santos%';
  SELECT COUNT(*) INTO events_count FROM public.events WHERE ts > now() - interval '7 days';
  SELECT COUNT(*) INTO vehicles_count FROM public.vehicle_detections WHERE detected_at > now() - interval '7 days';
  SELECT COUNT(*) INTO incidents_count FROM public.antitheft_incidents WHERE first_ts > now() - interval '7 days';
  
  RAISE NOTICE '===================================';
  RAISE NOTICE 'DADOS DEMO POPULADOS COM SUCESSO!';
  RAISE NOTICE '===================================';
  RAISE NOTICE 'Pessoas demo: %', people_count;
  RAISE NOTICE 'Eventos (7 dias): %', events_count;
  RAISE NOTICE 'Veículos (7 dias): %', vehicles_count;
  RAISE NOTICE 'Incidentes: %', incidents_count;
  RAISE NOTICE '===================================';
END $$;
