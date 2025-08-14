-- Create system parameters table
CREATE TABLE public.system_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- yolo, face, reid, fusion, clip, retention
    parameter_name TEXT NOT NULL,
    parameter_value JSONB NOT NULL,
    default_value JSONB NOT NULL,
    min_value JSONB,
    max_value JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    last_updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    org_id UUID DEFAULT current_org(),
    UNIQUE(category, parameter_name, org_id)
);

-- Create SLA monitoring table for Definition of Done
CREATE TABLE public.sla_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    current_value DOUBLE PRECISION NOT NULL,
    target_value DOUBLE PRECISION NOT NULL,
    threshold_type TEXT NOT NULL, -- lt, gt, eq
    measurement_window TEXT NOT NULL, -- 72h, 24h, realtime
    status TEXT NOT NULL, -- met, warning, failed
    last_measurement TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    org_id UUID DEFAULT current_org()
);

-- Create audit logs table for explain payloads
CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    decision_engine TEXT NOT NULL, -- fusion, detector, etc
    explain_payload JSONB NOT NULL,
    scores JSONB NOT NULL,
    thresholds JSONB NOT NULL,
    temporal_windows JSONB NOT NULL,
    signals_used JSONB NOT NULL,
    final_decision TEXT NOT NULL,
    confidence_score DOUBLE PRECISION,
    processing_time_ms INTEGER,
    camera_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    org_id UUID DEFAULT current_org()
);

-- Enable RLS
ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "system_parameters_isolated" ON public.system_parameters FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_system_parameters" ON public.system_parameters FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "sla_metrics_isolated" ON public.sla_metrics FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_sla_metrics" ON public.sla_metrics FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "audit_events_isolated" ON public.audit_events FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_audit_events" ON public.audit_events FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create triggers for updated_at
CREATE TRIGGER update_system_parameters_updated_at
    BEFORE UPDATE ON public.system_parameters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert recommended safe parameters
INSERT INTO public.system_parameters (category, parameter_name, parameter_value, default_value, min_value, max_value, description) VALUES

-- YOLO Parameters
('yolo', 'confidence_threshold', '0.40', '0.40', '0.20', '0.95', 'Confiança mínima para detecções YOLO (0.35-0.45 recomendado)'),
('yolo', 'iou_threshold', '0.50', '0.50', '0.20', '0.90', 'IoU threshold para NMS'),
('yolo', 'batch_size', '2', '2', '1', '8', 'Tamanho do batch para processamento'),
('yolo', 'fp16_enabled', 'true', 'true', 'false', 'true', 'Usar half precision para performance'),
('yolo', 'max_detections', '100', '100', '10', '1000', 'Máximo de detecções por frame'),

-- Face Recognition Parameters  
('face', 'similarity_threshold', '0.68', '0.68', '0.40', '0.95', 'Similaridade mínima para match facial (≥0.68 recomendado)'),
('face', 'temporal_confirmation_frames', '10', '10', '3', '30', 'Frames necessários para confirmação temporal (8-12 recomendado)'),
('face', 'face_quality_threshold', '0.50', '0.50', '0.20', '0.90', 'Qualidade mínima da face detectada'),
('face', 'temporal_window_seconds', '2.0', '2.0', '0.5', '10.0', 'Janela temporal para confirmação'),

-- Re-ID Parameters
('reid', 'distance_threshold', '0.55', '0.55', '0.20', '0.90', 'Distância máxima para Re-ID (≤0.55 recomendado)'),
('reid', 'association_window_seconds', '1.5', '1.5', '0.5', '5.0', 'Janela de associação temporal (1.5s recomendado)'),
('reid', 'ema_alpha', '0.7', '0.7', '0.1', '0.9', 'Alpha para Exponential Moving Average'),
('reid', 'min_track_length', '5', '5', '2', '20', 'Comprimento mínimo do track'),

-- Fusion Parameters
('fusion', 'required_signals', '2', '2', '1', '3', 'Sinais coerentes necessários (2 recomendado)'),
('fusion', 'strong_signal_threshold', '0.85', '0.85', '0.60', '0.95', 'Threshold para sinal muito forte'),
('fusion', 'strong_signal_window_frames', '12', '12', '5', '30', 'Frames para sinal forte (≥12 recomendado)'),
('fusion', 'decision_timeout_ms', '600', '600', '100', '2000', 'Timeout para decisão de fusão'),
('fusion', 'correlation_threshold', '0.75', '0.75', '0.50', '0.95', 'Correlação mínima entre sinais'),

-- Clip Parameters
('clip', 'pre_roll_seconds', '3', '3', '0', '10', 'Pre-roll antes do evento (3s recomendado)'),
('clip', 'post_roll_seconds', '5', '5', '0', '15', 'Post-roll após o evento (5s recomendado)'),
('clip', 'blur_faces_enabled', 'true', 'true', 'false', 'true', 'Aplicar blur em faces automaticamente'),
('clip', 'blur_plates_enabled', 'true', 'true', 'false', 'true', 'Aplicar blur em placas automaticamente'),
('clip', 'max_clip_duration_seconds', '60', '60', '10', '300', 'Duração máxima do clipe'),

-- Retention Parameters  
('retention', 'events_retention_days', '30', '30', '7', '365', 'Retenção de eventos confirmados (30 dias recomendado)'),
('retention', 'unconfirmed_clips_retention_days', '7', '7', '1', '30', 'Retenção de clipes não confirmados (7 dias recomendado)'),
('retention', 'metrics_retention_days', '90', '90', '30', '730', 'Retenção de métricas históricas'),
('retention', 'audit_logs_retention_days', '180', '180', '30', '2555', 'Retenção de logs de auditoria');

-- Insert SLA targets for Definition of Done
INSERT INTO public.sla_metrics (metric_name, current_value, target_value, threshold_type, measurement_window, status) VALUES
('ingestion_drops_72h', 0, 0, 'eq', '72h', 'met'),
('stall_recovery_time_seconds', 5.2, 10, 'lt', 'realtime', 'met'),
('pipeline_frozen_incidents', 0, 0, 'eq', '24h', 'met'),
('detection_latency_p95_ms', 95, 120, 'lt', 'realtime', 'met'),
('decision_latency_p95_ms', 480, 600, 'lt', 'realtime', 'met'),
('clip_availability_seconds', 7.8, 10, 'lt', 'realtime', 'met'),
('relevant_events_percentage', 87.5, 85, 'gt', '24h', 'met'),
('daily_report_delivered', 1, 1, 'eq', '24h', 'met'),
('critical_alerts_count', 0, 0, 'eq', 'realtime', 'met');