-- Create health metrics table
CREATE TABLE public.health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    metric_type TEXT NOT NULL, -- gauge, counter, histogram
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    org_id UUID DEFAULT current_org()
);

-- Create service status table
CREATE TABLE public.service_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- healthy, degraded, unhealthy
    last_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
    response_time_ms INTEGER,
    error_message TEXT,
    uptime_percentage DOUBLE PRECISION DEFAULT 100.0,
    metadata JSONB DEFAULT '{}',
    org_id UUID DEFAULT current_org()
);

-- Create alert rules table
CREATE TABLE public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    service_name TEXT,
    metric_name TEXT NOT NULL,
    condition_type TEXT NOT NULL, -- gt, lt, eq
    threshold_value DOUBLE PRECISION NOT NULL,
    duration_seconds INTEGER DEFAULT 60,
    severity TEXT NOT NULL, -- critical, warning, info
    is_active BOOLEAN DEFAULT true,
    alert_channels JSONB DEFAULT '["email"]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    org_id UUID DEFAULT current_org()
);

-- Create active alerts table
CREATE TABLE public.active_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.alert_rules(id),
    service_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    current_value DOUBLE PRECISION NOT NULL,
    threshold_value DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    status TEXT DEFAULT 'firing', -- firing, resolved
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    org_id UUID DEFAULT current_org()
);

-- Enable RLS
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "health_metrics_isolated" ON public.health_metrics FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_health_metrics" ON public.health_metrics FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_status_isolated" ON public.service_status FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_service_status" ON public.service_status FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "alert_rules_isolated" ON public.alert_rules FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_alert_rules" ON public.alert_rules FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "active_alerts_isolated" ON public.active_alerts FOR ALL USING (org_id = current_org());
CREATE POLICY "service_role_active_alerts" ON public.active_alerts FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_health_metrics_service_time ON public.health_metrics(service_name, timestamp DESC);
CREATE INDEX idx_health_metrics_metric_time ON public.health_metrics(metric_name, timestamp DESC);
CREATE INDEX idx_service_status_service ON public.service_status(service_name);
CREATE INDEX idx_active_alerts_status ON public.active_alerts(status, started_at);

-- Insert default alert rules
INSERT INTO public.alert_rules (rule_name, service_name, metric_name, condition_type, threshold_value, duration_seconds, severity) VALUES
('Stream Stall Alert', 'mediamtx', 'stream_stall_duration_seconds', 'gt', 60, 30, 'critical'),
('Queue Saturation Alert', 'fusion', 'queue_saturation_duration_seconds', 'gt', 30, 15, 'warning'),
('Decision Latency P95 Alert', 'fusion', 'decision_latency_p95_ms', 'gt', 1500, 60, 'warning'),
('Stream Reconnection Rate Alert', 'mediamtx', 'stream_reconnections_per_minute', 'gt', 5, 120, 'warning'),
('Pipeline Error Rate Alert', 'yolo-detection', 'error_rate_percent', 'gt', 5, 300, 'critical');