-- Create partner API keys table
CREATE TABLE public.partner_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  white_label_config JSONB DEFAULT '{}',
  quotas JSONB DEFAULT '{}',
  billing_rate_per_event NUMERIC DEFAULT 0.05,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create LGPD compliance table
CREATE TABLE public.lgpd_compliance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_subject_id TEXT NOT NULL,
  data_subject_type TEXT DEFAULT 'visitor' CHECK (data_subject_type IN ('visitor', 'member', 'staff')),
  consent_status TEXT DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'withdrawn', 'expired')),
  consent_date TIMESTAMP WITH TIME ZONE,
  withdrawal_date TIMESTAMP WITH TIME ZONE,
  retention_until TIMESTAMP WITH TIME ZONE,
  deletion_requested BOOLEAN DEFAULT false,
  deletion_completed BOOLEAN DEFAULT false,
  deletion_date TIMESTAMP WITH TIME ZONE,
  legal_basis TEXT,
  processing_purposes JSONB DEFAULT '[]',
  data_categories JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partner billing usage table
CREATE TABLE public.partner_billing_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.partner_api_keys(id) ON DELETE CASCADE,
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  usage_date DATE DEFAULT CURRENT_DATE,
  event_count INTEGER DEFAULT 0,
  cost_per_event NUMERIC DEFAULT 0.05,
  total_cost NUMERIC GENERATED ALWAYS AS (event_count * cost_per_event) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create observability metrics table
CREATE TABLE public.observability_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT DEFAULT 'count',
  aggregation_period TEXT DEFAULT 'hour',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Create cost estimation table
CREATE TABLE public.camera_cost_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL,
  cost_date DATE DEFAULT CURRENT_DATE,
  compute_cost NUMERIC DEFAULT 0.0,
  storage_cost NUMERIC DEFAULT 0.0,
  bandwidth_cost NUMERIC DEFAULT 0.0,
  ai_processing_cost NUMERIC DEFAULT 0.0,
  total_estimated_cost NUMERIC DEFAULT 0.0,
  events_processed INTEGER DEFAULT 0,
  cost_per_event NUMERIC DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_billing_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_cost_estimates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "partner_api_keys_admin_only" ON public.partner_api_keys FOR ALL USING (false);
CREATE POLICY "lgpd_compliance_tenant_isolation" ON public.lgpd_compliance FOR ALL USING (tenant_id = current_org());
CREATE POLICY "partner_billing_usage_admin_only" ON public.partner_billing_usage FOR ALL USING (false);
CREATE POLICY "observability_metrics_tenant_isolation" ON public.observability_metrics FOR ALL USING (tenant_id = current_org());
CREATE POLICY "camera_cost_estimates_tenant_isolation" ON public.camera_cost_estimates FOR ALL USING (tenant_id = current_org());

-- Service role policies
CREATE POLICY "service_role_partner_api_keys" ON public.partner_api_keys FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_lgpd_compliance" ON public.lgpd_compliance FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_partner_billing_usage" ON public.partner_billing_usage FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_observability_metrics" ON public.observability_metrics FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_camera_cost_estimates" ON public.camera_cost_estimates FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add triggers for updated_at
CREATE TRIGGER update_lgpd_compliance_updated_at BEFORE UPDATE ON public.lgpd_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate partner API key
CREATE OR REPLACE FUNCTION public.validate_partner_api_key(api_key TEXT)
RETURNS TABLE(partner_id UUID, partner_name TEXT, white_label_config JSONB, quotas JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT pak.id, pak.partner_name, pak.white_label_config, pak.quotas
    FROM public.partner_api_keys pak
    WHERE pak.api_key = validate_partner_api_key.api_key 
    AND pak.is_active = true
    AND (pak.expires_at IS NULL OR pak.expires_at > now());
END;
$$;

-- Function to process data deletion requests
CREATE OR REPLACE FUNCTION public.process_data_deletion_request(
    p_tenant_id UUID,
    p_data_subject_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deletion_summary JSONB := '{}';
    records_deleted INTEGER := 0;
BEGIN
    -- Mark for deletion in LGPD compliance
    UPDATE public.lgpd_compliance
    SET deletion_requested = true,
        deletion_date = now()
    WHERE tenant_id = p_tenant_id 
    AND data_subject_id = p_data_subject_id;
    
    -- Delete from visitors table
    DELETE FROM public.visitors
    WHERE tenant_id = p_tenant_id 
    AND (visitor_code = p_data_subject_id OR id::text = p_data_subject_id);
    GET DIAGNOSTICS records_deleted = ROW_COUNT;
    
    deletion_summary := deletion_summary || jsonb_build_object('visitors_deleted', records_deleted);
    
    -- Delete from attendance records
    DELETE FROM public.attendance
    WHERE visitor_id::text = p_data_subject_id;
    GET DIAGNOSTICS records_deleted = ROW_COUNT;
    
    deletion_summary := deletion_summary || jsonb_build_object('attendance_deleted', records_deleted);
    
    -- Mark completion in LGPD compliance
    UPDATE public.lgpd_compliance
    SET deletion_completed = true
    WHERE tenant_id = p_tenant_id 
    AND data_subject_id = p_data_subject_id;
    
    deletion_summary := deletion_summary || jsonb_build_object('deletion_completed_at', now());
    
    RETURN deletion_summary;
END;
$$;

-- Function to update cost estimates
CREATE OR REPLACE FUNCTION public.update_camera_cost_estimates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.total_estimated_cost = NEW.compute_cost + NEW.storage_cost + NEW.bandwidth_cost + NEW.ai_processing_cost;
    
    IF NEW.events_processed > 0 THEN
        NEW.cost_per_event = NEW.total_estimated_cost / NEW.events_processed;
    ELSE
        NEW.cost_per_event = 0;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger for cost estimates calculation
CREATE TRIGGER update_camera_cost_estimates_trigger
    BEFORE INSERT OR UPDATE ON public.camera_cost_estimates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_camera_cost_estimates();