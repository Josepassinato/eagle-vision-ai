-- Check if tables exist and create only if needed
DO $$
BEGIN
    -- Create performance metrics table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_metrics') THEN
        CREATE TABLE public.performance_metrics (
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
        
        ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "performance_metrics_isolated" ON public.performance_metrics
        FOR ALL USING (org_id = current_org());
        
        CREATE POLICY "service_role_performance_metrics" ON public.performance_metrics
        FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
        
        CREATE INDEX idx_performance_metrics_service_timestamp ON public.performance_metrics(service_name, timestamp);
        CREATE INDEX idx_performance_metrics_org_timestamp ON public.performance_metrics(org_id, timestamp);
    END IF;

    -- Create system health metrics table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_health_metrics') THEN
        CREATE TABLE public.system_health_metrics (
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
        
        ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "system_health_metrics_isolated" ON public.system_health_metrics
        FOR ALL USING (org_id = current_org());
        
        CREATE POLICY "service_role_system_health_metrics" ON public.system_health_metrics
        FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
        
        CREATE INDEX idx_system_health_metrics_service ON public.system_health_metrics(service_name);
    END IF;

    -- Create operational reports table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operational_reports') THEN
        CREATE TABLE public.operational_reports (
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
        
        ALTER TABLE public.operational_reports ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "operational_reports_isolated" ON public.operational_reports
        FOR ALL USING (org_id = current_org());
        
        CREATE POLICY "service_role_operational_reports" ON public.operational_reports
        FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
        
        CREATE INDEX idx_operational_reports_date ON public.operational_reports(report_date, org_id);
    END IF;
END
$$;