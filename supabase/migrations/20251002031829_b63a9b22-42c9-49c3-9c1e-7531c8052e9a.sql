-- Criar tabela de detecções de veículos
CREATE TABLE IF NOT EXISTS public.vehicle_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  camera_id TEXT NOT NULL,
  plate_text TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  vehicle_type TEXT,
  color TEXT,
  bbox JSONB,
  image_url TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_detections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "vehicle_detections_isolated" ON public.vehicle_detections
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_vehicle_detections" ON public.vehicle_detections
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
  );

-- Índices para performance
CREATE INDEX idx_vehicle_detections_plate ON public.vehicle_detections(plate_text);
CREATE INDEX idx_vehicle_detections_detected_at ON public.vehicle_detections(detected_at DESC);
CREATE INDEX idx_vehicle_detections_camera ON public.vehicle_detections(camera_id);

-- Função de busca por placa
CREATE OR REPLACE FUNCTION search_plates(
  search_term TEXT,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  plate_text TEXT,
  camera_id TEXT,
  detected_at TIMESTAMPTZ,
  confidence FLOAT,
  image_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, plate_text, camera_id, detected_at, confidence, image_url
  FROM public.vehicle_detections
  WHERE org_id = current_org()
    AND plate_text ILIKE '%' || search_term || '%'
  ORDER BY detected_at DESC
  LIMIT limit_count;
$$;