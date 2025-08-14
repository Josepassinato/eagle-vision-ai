-- Performance & Scalability Database Optimizations

-- Create performance monitoring tables
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  metric_type TEXT NOT NULL, -- 'response_time', 'throughput', 'cpu_usage', 'memory_usage'
  service_name TEXT NOT NULL,
  instance_id TEXT,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL, -- 'ms', 'requests/sec', 'percentage', 'bytes'
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Auto-scaling configuration and events
CREATE TABLE public.scaling_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  min_instances INTEGER NOT NULL DEFAULT 1,
  max_instances INTEGER NOT NULL DEFAULT 10,
  target_cpu_utilization DOUBLE PRECISION DEFAULT 70.0,
  target_memory_utilization DOUBLE PRECISION DEFAULT 80.0,
  scale_up_threshold DOUBLE PRECISION DEFAULT 80.0,
  scale_down_threshold DOUBLE PRECISION DEFAULT 30.0,
  cooldown_period_seconds INTEGER DEFAULT 300,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.scaling_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  policy_id UUID NOT NULL REFERENCES public.scaling_policies(id),
  event_type TEXT NOT NULL, -- 'scale_up', 'scale_down', 'scale_out', 'scale_in'
  trigger_metric TEXT NOT NULL,
  trigger_value DOUBLE PRECISION NOT NULL,
  current_instances INTEGER NOT NULL,
  target_instances INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- CDN and cache configuration
CREATE TABLE public.cdn_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  domain TEXT NOT NULL,
  cdn_provider TEXT NOT NULL, -- 'cloudflare', 'aws_cloudfront', 'azure_cdn'
  edge_locations TEXT[], -- array of edge location codes
  cache_policies JSONB NOT NULL, -- cache rules and TTL settings
  compression_enabled BOOLEAN DEFAULT true,
  minification_enabled BOOLEAN DEFAULT true,
  brotli_enabled BOOLEAN DEFAULT true,
  ssl_enabled BOOLEAN DEFAULT true,
  ddos_protection BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.cache_invalidations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  cdn_config_id UUID NOT NULL REFERENCES public.cdn_configurations(id),
  invalidation_type TEXT NOT NULL, -- 'path', 'tag', 'wildcard', 'full'
  target_paths TEXT[],
  cache_tags TEXT[],
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  provider_request_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Database optimization tracking
CREATE TABLE public.query_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  query_hash TEXT NOT NULL, -- hash of the normalized query
  query_text TEXT,
  table_names TEXT[],
  execution_time_ms DOUBLE PRECISION NOT NULL,
  rows_examined BIGINT,
  rows_returned BIGINT,
  index_used TEXT[],
  full_table_scan BOOLEAN DEFAULT false,
  temporary_tables INTEGER DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  session_id TEXT
);

-- Cache strategy tracking
CREATE TABLE public.cache_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  cache_type TEXT NOT NULL, -- 'redis', 'memcached', 'application', 'database'
  cache_key TEXT NOT NULL,
  cache_namespace TEXT,
  operation TEXT NOT NULL, -- 'hit', 'miss', 'set', 'delete', 'expire'
  ttl_seconds INTEGER,
  data_size_bytes INTEGER,
  execution_time_ms DOUBLE PRECISION,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for all new tables
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scaling_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scaling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdn_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY "performance_metrics_isolated" ON public.performance_metrics
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_performance_metrics" ON public.performance_metrics
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "scaling_policies_isolated" ON public.scaling_policies
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_scaling_policies" ON public.scaling_policies
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "scaling_events_isolated" ON public.scaling_events
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_scaling_events" ON public.scaling_events
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "cdn_configurations_isolated" ON public.cdn_configurations
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_cdn_configurations" ON public.cdn_configurations
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "cache_invalidations_isolated" ON public.cache_invalidations
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_cache_invalidations" ON public.cache_invalidations
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "query_performance_isolated" ON public.query_performance
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_query_performance" ON public.query_performance
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "cache_metrics_isolated" ON public.cache_metrics
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_cache_metrics" ON public.cache_metrics
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add update triggers
CREATE TRIGGER update_scaling_policies_updated_at
  BEFORE UPDATE ON public.scaling_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cdn_configurations_updated_at
  BEFORE UPDATE ON public.cdn_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Performance indexes for existing tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_real_time_metrics_performance 
  ON public.real_time_metrics(org_id, timestamp DESC, metric_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detections_performance 
  ON public.detections(org_id, created_at DESC, detection_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_frame_analysis_performance 
  ON public.frame_analysis(org_id, timestamp DESC, camera_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_performance 
  ON public.incidents(org_id, first_ts DESC, status);

-- New performance indexes
CREATE INDEX idx_performance_metrics_timestamp ON public.performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_service ON public.performance_metrics(org_id, service_name, timestamp);
CREATE INDEX idx_scaling_events_policy ON public.scaling_events(policy_id, started_at DESC);
CREATE INDEX idx_query_performance_hash ON public.query_performance(query_hash, executed_at DESC);
CREATE INDEX idx_cache_metrics_type_time ON public.cache_metrics(cache_type, timestamp DESC);

-- Partitioning for high-volume tables (performance_metrics)
-- Note: This creates the partition structure, data migration would happen separately
CREATE TABLE public.performance_metrics_y2025m01 PARTITION OF public.performance_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE public.performance_metrics_y2025m02 PARTITION OF public.performance_metrics
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE public.performance_metrics_y2025m03 PARTITION OF public.performance_metrics
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create materialized views for performance
CREATE MATERIALIZED VIEW public.mv_daily_performance_summary AS
SELECT 
    org_id,
    service_name,
    DATE(timestamp) as metric_date,
    metric_type,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median_value,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95_value,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99_value,
    COUNT(*) as sample_count
FROM public.performance_metrics
GROUP BY org_id, service_name, DATE(timestamp), metric_type;

CREATE UNIQUE INDEX idx_mv_daily_performance_summary 
    ON public.mv_daily_performance_summary(org_id, service_name, metric_date, metric_type);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_performance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for real-time scaling status
CREATE VIEW public.v_current_scaling_status AS
SELECT 
    sp.id,
    sp.org_id,
    sp.service_name,
    sp.policy_name,
    sp.enabled,
    sp.min_instances,
    sp.max_instances,
    sp.target_cpu_utilization,
    sp.target_memory_utilization,
    COALESCE(latest_event.current_instances, sp.min_instances) as current_instances,
    latest_event.status as last_scaling_status,
    latest_event.started_at as last_scaling_time
FROM public.scaling_policies sp
LEFT JOIN LATERAL (
    SELECT current_instances, status, started_at
    FROM public.scaling_events se
    WHERE se.policy_id = sp.id
    ORDER BY se.started_at DESC
    LIMIT 1
) latest_event ON true
WHERE sp.enabled = true;