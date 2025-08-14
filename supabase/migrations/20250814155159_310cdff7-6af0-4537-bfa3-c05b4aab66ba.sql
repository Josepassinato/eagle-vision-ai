-- Create comprehensive security and compliance tables

-- Personal data inventory for GDPR/LGPD tracking
CREATE TABLE IF NOT EXISTS public.personal_data_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_category TEXT NOT NULL, -- personal, sensitive, biometric, etc.
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  retention_period_days INTEGER,
  anonymization_method TEXT,
  is_anonymized BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Data anonymization jobs
CREATE TABLE IF NOT EXISTS public.anonymization_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  job_type TEXT NOT NULL, -- 'scheduled', 'manual', 'automatic'
  target_table TEXT NOT NULL,
  anonymization_rules JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhanced RBAC permissions
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource_type TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'execute'
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Role-permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE(role, permission_id)
);

-- Encryption keys management
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  key_name TEXT NOT NULL,
  key_type TEXT NOT NULL, -- 'aes256', 'rsa2048', 'ed25519'
  key_purpose TEXT NOT NULL, -- 'data', 'transport', 'backup'
  key_hash TEXT NOT NULL, -- Hash of the key for verification
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rotated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(org_id, key_name)
);

-- Data access logs for compliance
CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  user_id UUID,
  access_type TEXT NOT NULL, -- 'read', 'write', 'delete', 'export'
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  data_subject_id TEXT, -- For GDPR/LGPD tracking
  purpose TEXT,
  legal_basis TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'
);

-- Consent management
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  data_subject_id TEXT NOT NULL,
  data_subject_type TEXT NOT NULL, -- 'person', 'employee', 'customer'
  consent_type TEXT NOT NULL, -- 'data_processing', 'marketing', 'analytics'
  purpose TEXT NOT NULL,
  given_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  legal_basis TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.personal_data_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY "personal_data_inventory_org_access" ON public.personal_data_inventory
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "anonymization_jobs_org_access" ON public.anonymization_jobs
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "rbac_permissions_read_all" ON public.rbac_permissions
  FOR SELECT USING (true);

CREATE POLICY "rbac_permissions_admin_write" ON public.rbac_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "role_permissions_read_all" ON public.role_permissions
  FOR SELECT USING (true);

CREATE POLICY "role_permissions_admin_write" ON public.role_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "encryption_keys_org_access" ON public.encryption_keys
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "data_access_logs_org_access" ON public.data_access_logs
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "consent_records_org_access" ON public.consent_records
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

-- Service role policies for automated systems
CREATE POLICY "service_role_personal_data_inventory" ON public.personal_data_inventory
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_anonymization_jobs" ON public.anonymization_jobs
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_encryption_keys" ON public.encryption_keys
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_data_access_logs" ON public.data_access_logs
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_consent_records" ON public.consent_records
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create update triggers
CREATE TRIGGER update_personal_data_inventory_updated_at
  BEFORE UPDATE ON public.personal_data_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default RBAC permissions
INSERT INTO public.rbac_permissions (name, description, resource_type, action) VALUES
  ('cameras.create', 'Create new cameras', 'cameras', 'create'),
  ('cameras.read', 'View cameras', 'cameras', 'read'),
  ('cameras.update', 'Update camera settings', 'cameras', 'update'),
  ('cameras.delete', 'Delete cameras', 'cameras', 'delete'),
  ('analytics.read', 'View analytics', 'analytics', 'read'),
  ('incidents.read', 'View incidents', 'incidents', 'read'),
  ('incidents.update', 'Update incidents', 'incidents', 'update'),
  ('users.create', 'Create users', 'users', 'create'),
  ('users.read', 'View users', 'users', 'read'),
  ('users.update', 'Update users', 'users', 'update'),
  ('users.delete', 'Delete users', 'users', 'delete'),
  ('compliance.read', 'View compliance data', 'compliance', 'read'),
  ('compliance.manage', 'Manage compliance settings', 'compliance', 'update'),
  ('audit.read', 'View audit logs', 'audit', 'read')
ON CONFLICT (name) DO NOTHING;

-- Assign default permissions to roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.rbac_permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Insert sample personal data inventory (without org_id constraint)
INSERT INTO public.personal_data_inventory (table_name, column_name, data_category, purpose, legal_basis, retention_period_days, anonymization_method) VALUES
  ('people', 'name', 'personal', 'Identification', 'legitimate_interest', 2555, 'pseudonymization'),
  ('people', 'face_embedding', 'biometric', 'Face recognition', 'consent', 365, 'deletion'),
  ('events', 'person_id', 'personal', 'Incident tracking', 'legitimate_interest', 1095, 'pseudonymization'),
  ('antitheft_incidents', 'person_id', 'personal', 'Security monitoring', 'legitimate_interest', 2555, 'pseudonymization')
ON CONFLICT DO NOTHING;

-- Create function to check RBAC permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.rbac_permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id 
    AND p.name = _permission_name
  );
$$;

-- Create function to log data access
CREATE OR REPLACE FUNCTION public.log_data_access(
  _access_type TEXT,
  _resource_type TEXT,
  _resource_id TEXT DEFAULT NULL,
  _data_subject_id TEXT DEFAULT NULL,
  _purpose TEXT DEFAULT NULL,
  _legal_basis TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.data_access_logs (
    user_id, access_type, resource_type, resource_id, 
    data_subject_id, purpose, legal_basis
  ) VALUES (
    auth.uid(), _access_type, _resource_type, _resource_id,
    _data_subject_id, _purpose, _legal_basis
  )
  RETURNING id;
$$;