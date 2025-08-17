-- Create BigQuery sync configuration table
CREATE TABLE public.bigquery_sync_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  table_mappings JSONB NOT NULL DEFAULT '{}',
  sync_frequency_seconds INTEGER DEFAULT 30,
  last_sync_timestamp TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create BI reports table
CREATE TABLE public.bi_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('service_summary', 'monthly_analytics', 'visitor_analysis', 'occupancy_heatmap')),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  report_name TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  file_path TEXT,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create dashboard configurations
CREATE TABLE public.dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  dashboard_name TEXT NOT NULL,
  dashboard_type TEXT DEFAULT 'pastor' CHECK (dashboard_type IN ('pastor', 'admin', 'analytics')),
  widget_configs JSONB NOT NULL DEFAULT '[]',
  refresh_interval_seconds INTEGER DEFAULT 60,
  is_public BOOLEAN DEFAULT false,
  public_share_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create data sync logs
CREATE TABLE public.data_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  target_system TEXT NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  latency_ms INTEGER,
  error_details JSONB,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bigquery_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "bigquery_sync_config_tenant_isolation" ON public.bigquery_sync_config FOR ALL USING (tenant_id = current_org());
CREATE POLICY "bi_reports_tenant_isolation" ON public.bi_reports FOR ALL USING (tenant_id = current_org());
CREATE POLICY "dashboard_configs_tenant_isolation" ON public.dashboard_configs FOR ALL USING (tenant_id = current_org());
CREATE POLICY "data_sync_logs_tenant_isolation" ON public.data_sync_logs FOR ALL USING (tenant_id = current_org());

-- Service role policies
CREATE POLICY "service_role_bigquery_sync_config" ON public.bigquery_sync_config FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_bi_reports" ON public.bi_reports FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_dashboard_configs" ON public.dashboard_configs FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_data_sync_logs" ON public.data_sync_logs FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add triggers for updated_at
CREATE TRIGGER update_bigquery_sync_config_updated_at BEFORE UPDATE ON public.bigquery_sync_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON public.dashboard_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate report file path
CREATE OR REPLACE FUNCTION public.generate_report_path(
  tenant_id UUID,
  report_type TEXT,
  service_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  timestamp_str TEXT;
  service_name TEXT := '';
BEGIN
  timestamp_str := to_char(now(), 'YYYY/MM/DD');
  
  IF service_id IS NOT NULL THEN
    SELECT name INTO service_name FROM public.services WHERE id = service_id;
    service_name := COALESCE('_' || replace(service_name, ' ', '_'), '');
  END IF;
  
  RETURN 'reports/' || tenant_id || '/' || timestamp_str || '/' || 
         report_type || service_name || '_' || 
         extract(epoch from now())::bigint || '.pdf';
END;
$$;