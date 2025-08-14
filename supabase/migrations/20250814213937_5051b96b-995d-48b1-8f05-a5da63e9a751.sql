-- Create operational quality tracking tables

-- Performance metrics table for tracking latency and throughput
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'latency', 'throughput', 'error_rate'
    metric_value DOUBLE PRECISION NOT NULL,
    percentile INTEGER, -- 50, 95, 99 for latency metrics
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    camera_id TEXT,
    org_id UUID DEFAULT current_org(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- System health metrics for stability tracking
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    uptime_percentage DOUBLE PRECISION NOT NULL,
    recovery_time_seconds DOUBLE PRECISION,
    circuit_breaker_state TEXT, -- 'closed', 'open', 'half_open'
    queue_size INTEGER DEFAULT 0,
    queue_limit INTEGER DEFAULT 500,
    error_count INTEGER DEFAULT 0,
    last_failure TIMESTAMP WITH TIME ZONE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    org_id UUID DEFAULT current_org(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Clip integrity tracking for auditability
CREATE TABLE IF NOT EXISTS public.clip_integrity (
    clip_id UUID PRIMARY KEY,
    checksum TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'pending', -- 'verified', 'failed', 'pending'
    generation_time_seconds DOUBLE PRECISION,
    size_bytes BIGINT,
    privacy_applied BOOLEAN DEFAULT false,
    retention_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    verified_at TIMESTAMP WITH TIME ZONE,
    org_id UUID DEFAULT current_org()
);

-- Daily operational reports tracking
CREATE TABLE IF NOT EXISTS public.operational_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    metrics_summary JSONB NOT NULL,
    pdf_url TEXT,
    csv_url TEXT,
    email_sent BOOLEAN DEFAULT false,
    email_recipients TEXT[],
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    org_id UUID DEFAULT current_org()
);

-- Service level objectives tracking
CREATE TABLE IF NOT EXISTS public.slo_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    slo_type TEXT NOT NULL, -- 'latency', 'availability', 'error_rate'
    target_value DOUBLE PRECISION NOT NULL,
    actual_value DOUBLE PRECISION NOT NULL,
    violation_duration_seconds INTEGER,
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    org_id UUID DEFAULT current_org(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on all tables
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_integrity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slo_violations ENABLE ROW LEVEL SECURITY;

-- RLS policies for org isolation
CREATE POLICY "performance_metrics_isolated" ON public.performance_metrics
FOR ALL USING (org_id = current_org());

CREATE POLICY "system_health_metrics_isolated" ON public.system_health_metrics
FOR ALL USING (org_id = current_org());

CREATE POLICY "clip_integrity_isolated" ON public.clip_integrity
FOR ALL USING (org_id = current_org());

CREATE POLICY "operational_reports_isolated" ON public.operational_reports
FOR ALL USING (org_id = current_org());

CREATE POLICY "slo_violations_isolated" ON public.slo_violations
FOR ALL USING (org_id = current_org());

-- Service role policies for automated systems
CREATE POLICY "service_role_performance_metrics" ON public.performance_metrics
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_system_health_metrics" ON public.system_health_metrics
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_clip_integrity" ON public.clip_integrity
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_operational_reports" ON public.operational_reports
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_slo_violations" ON public.slo_violations
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_metrics_service_timestamp ON public.performance_metrics(service_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_org_timestamp ON public.performance_metrics(org_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_service ON public.system_health_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_clip_integrity_verification ON public.clip_integrity(verification_status, created_at);
CREATE INDEX IF NOT EXISTS idx_operational_reports_date ON public.operational_reports(report_date, org_id);
CREATE INDEX IF NOT EXISTS idx_slo_violations_severity ON public.slo_violations(severity, created_at);

-- Function to automatically calculate SLO violations
CREATE OR REPLACE FUNCTION public.check_slo_violations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    service_record RECORD;
    latency_p95 DOUBLE PRECISION;
    availability DOUBLE PRECISION;
BEGIN
    -- Check latency SLOs for detector services (target: p95 < 120ms)
    FOR service_record IN 
        SELECT DISTINCT service_name FROM public.performance_metrics 
        WHERE service_name LIKE '%detector%' OR service_name LIKE '%yolo%'
    LOOP
        SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value)
        INTO latency_p95
        FROM public.performance_metrics
        WHERE service_name = service_record.service_name
          AND metric_type = 'latency'
          AND timestamp > now() - INTERVAL '1 hour';
          
        IF latency_p95 > 120 THEN
            INSERT INTO public.slo_violations (
                service_name, slo_type, target_value, actual_value,
                severity, metadata
            ) VALUES (
                service_record.service_name, 'latency', 120, latency_p95,
                CASE WHEN latency_p95 > 200 THEN 'critical'
                     WHEN latency_p95 > 150 THEN 'high' 
                     ELSE 'medium' END,
                jsonb_build_object('measurement_period', '1_hour')
            );
        END IF;
    END LOOP;
    
    -- Check fusion service latency SLO (target: p95 < 600ms)
    FOR service_record IN 
        SELECT DISTINCT service_name FROM public.performance_metrics 
        WHERE service_name LIKE '%fusion%'
    LOOP
        SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value)
        INTO latency_p95
        FROM public.performance_metrics
        WHERE service_name = service_record.service_name
          AND metric_type = 'latency'
          AND timestamp > now() - INTERVAL '1 hour';
          
        IF latency_p95 > 600 THEN
            INSERT INTO public.slo_violations (
                service_name, slo_type, target_value, actual_value,
                severity, metadata
            ) VALUES (
                service_record.service_name, 'latency', 600, latency_p95,
                CASE WHEN latency_p95 > 1000 THEN 'critical'
                     WHEN latency_p95 > 800 THEN 'high' 
                     ELSE 'medium' END,
                jsonb_build_object('measurement_period', '1_hour')
            );
        END IF;
    END LOOP;
    
    -- Check availability SLOs (target: > 99.5%)
    FOR service_record IN 
        SELECT DISTINCT service_name FROM public.system_health_metrics 
    LOOP
        SELECT uptime_percentage INTO availability
        FROM public.system_health_metrics
        WHERE service_name = service_record.service_name
        ORDER BY timestamp DESC
        LIMIT 1;
        
        IF availability < 99.5 THEN
            INSERT INTO public.slo_violations (
                service_name, slo_type, target_value, actual_value,
                severity, metadata
            ) VALUES (
                service_record.service_name, 'availability', 99.5, availability,
                CASE WHEN availability < 95 THEN 'critical'
                     WHEN availability < 98 THEN 'high' 
                     ELSE 'medium' END,
                jsonb_build_object('measurement_period', 'current')
            );
        END IF;
    END LOOP;
END;
$$;

-- Function to update clip integrity with checksums
CREATE OR REPLACE FUNCTION public.update_clip_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert or update clip integrity record when clip is created/updated
    INSERT INTO public.clip_integrity (
        clip_id, 
        checksum, 
        generation_time_seconds,
        size_bytes,
        privacy_applied,
        retention_expires_at,
        org_id
    ) VALUES (
        NEW.id,
        COALESCE(NEW.checksum, md5(NEW.clip_path || NEW.created_at::text)),
        EXTRACT(EPOCH FROM (NEW.created_at - NEW.upload_requested_at)),
        NEW.file_size_bytes,
        NEW.privacy_applied,
        NEW.expires_at,
        NEW.org_id
    )
    ON CONFLICT (clip_id) DO UPDATE SET
        checksum = EXCLUDED.checksum,
        generation_time_seconds = EXCLUDED.generation_time_seconds,
        size_bytes = EXCLUDED.size_bytes,
        privacy_applied = EXCLUDED.privacy_applied,
        retention_expires_at = EXCLUDED.retention_expires_at;
        
    RETURN NEW;
END;
$$;

-- Create trigger for automatic clip integrity tracking
CREATE TRIGGER trigger_update_clip_integrity
    AFTER INSERT OR UPDATE ON public.edge_clips
    FOR EACH ROW
    EXECUTE FUNCTION public.update_clip_integrity();

-- Update audit_events to ensure explain_payload exists
ALTER TABLE public.audit_events 
ADD COLUMN IF NOT EXISTS explain_payload_hash TEXT;

-- Function to ensure audit events have explain payloads
CREATE OR REPLACE FUNCTION public.ensure_explain_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure explain_payload exists and generate hash
    IF NEW.explain_payload IS NULL THEN
        NEW.explain_payload = jsonb_build_object(
            'decision_engine', NEW.decision_engine,
            'final_decision', NEW.final_decision,
            'confidence_score', NEW.confidence_score,
            'processing_time_ms', NEW.processing_time_ms,
            'timestamp', NEW.timestamp
        );
    END IF;
    
    -- Generate hash of explain payload for integrity
    NEW.explain_payload_hash = md5(NEW.explain_payload::text);
    
    RETURN NEW;
END;
$$;

-- Create trigger for automatic explain payload generation
CREATE TRIGGER trigger_ensure_explain_payload
    BEFORE INSERT OR UPDATE ON public.audit_events
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_explain_payload();