-- Create tenants table for multi-tenancy
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  subdomain TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create services table (cultos/services)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_type TEXT DEFAULT 'worship',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  expected_attendance INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  visitor_id UUID,
  camera_id TEXT,
  zone_name TEXT,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  exit_time TIMESTAMP WITH TIME ZONE,
  method TEXT DEFAULT 'detection' CHECK (method IN ('detection', 'checkin', 'manual')),
  confidence NUMERIC DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create visitors table
CREATE TABLE public.visitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_code TEXT UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  member_status TEXT DEFAULT 'visitor' CHECK (member_status IN ('visitor', 'member', 'leader')),
  first_visit TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_visit TIMESTAMP WITH TIME ZONE DEFAULT now(),
  visit_count INTEGER DEFAULT 1,
  preferences JSONB DEFAULT '{}',
  opt_in_data_processing BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create affinity_rules table
CREATE TABLE public.affinity_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('proximity', 'temporal', 'behavioral')),
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clips retention table
CREATE TABLE public.clips_retention (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  clip_path TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  retention_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  exception_reason TEXT,
  incident_reference TEXT,
  is_protected BOOLEAN DEFAULT false
);

-- Create API audit logs
CREATE TABLE public.api_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  api_key_used TEXT,
  request_payload JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affinity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenants_org_isolation" ON public.tenants FOR ALL USING (id = current_org());
CREATE POLICY "services_tenant_isolation" ON public.services FOR ALL USING (tenant_id = current_org());
CREATE POLICY "attendance_tenant_isolation" ON public.attendance FOR ALL USING (true);
CREATE POLICY "visitors_tenant_isolation" ON public.visitors FOR ALL USING (tenant_id = current_org());
CREATE POLICY "affinity_rules_tenant_isolation" ON public.affinity_rules FOR ALL USING (tenant_id = current_org());
CREATE POLICY "clips_retention_tenant_isolation" ON public.clips_retention FOR ALL USING (tenant_id = current_org());
CREATE POLICY "api_audit_logs_tenant_isolation" ON public.api_audit_logs FOR ALL USING (tenant_id = current_org());

-- Service role policies
CREATE POLICY "service_role_tenants" ON public.tenants FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_services" ON public.services FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_attendance" ON public.attendance FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_visitors" ON public.visitors FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_affinity_rules" ON public.affinity_rules FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_clips_retention" ON public.clips_retention FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);
CREATE POLICY "service_role_api_audit_logs" ON public.api_audit_logs FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_affinity_rules_updated_at BEFORE UPDATE ON public.affinity_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate clips expiration
CREATE OR REPLACE FUNCTION public.calculate_clip_retention()
RETURNS TRIGGER AS $$
BEGIN
    NEW.expires_at = NEW.created_at + (NEW.retention_days || ' days')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for clips retention
CREATE TRIGGER calculate_clips_expiration
    BEFORE INSERT ON public.clips_retention
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_clip_retention();

-- Function to validate tenant API key
CREATE OR REPLACE FUNCTION public.validate_tenant_api_key(api_key TEXT)
RETURNS UUID AS $$
DECLARE
    tenant_id UUID;
BEGIN
    SELECT id INTO tenant_id 
    FROM public.tenants 
    WHERE api_key = validate_tenant_api_key.api_key 
    AND is_active = true;
    
    RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;