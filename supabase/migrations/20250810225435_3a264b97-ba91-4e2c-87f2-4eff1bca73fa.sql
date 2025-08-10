-- Compliance & Privacy Schema

-- Data retention policies
CREATE TABLE public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'clips', 'metrics', 'events', 'logs'
  retention_days INTEGER NOT NULL,
  auto_delete BOOLEAN NOT NULL DEFAULT true,
  legal_basis TEXT, -- LGPD legal basis
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Privacy consent management
CREATE TABLE public.privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  data_subject_type TEXT NOT NULL, -- 'student', 'employee', 'visitor'
  data_subject_id TEXT, -- external ID (student ID, employee ID, etc.)
  consent_type TEXT NOT NULL, -- 'video_monitoring', 'facial_recognition', 'behavior_analysis'
  consent_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'granted', 'denied', 'withdrawn'
  legal_basis TEXT NOT NULL, -- 'consent', 'legitimate_interest', 'legal_obligation', 'vital_interests'
  purpose TEXT NOT NULL, -- 'safety_monitoring', 'educational_analytics', 'security'
  consent_date TIMESTAMPTZ,
  withdrawal_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Privacy settings per organization
CREATE TABLE public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  face_blur_enabled BOOLEAN NOT NULL DEFAULT false,
  license_plate_blur_enabled BOOLEAN NOT NULL DEFAULT false,
  anonymization_mode TEXT NOT NULL DEFAULT 'none', -- 'none', 'partial', 'full'
  data_minimization BOOLEAN NOT NULL DEFAULT true,
  consent_required BOOLEAN NOT NULL DEFAULT true,
  compliance_framework TEXT NOT NULL DEFAULT 'LGPD', -- 'LGPD', 'FERPA', 'GDPR'
  retention_override JSONB DEFAULT '{}', -- Override default retention by data type
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Audit trail for all data access and modifications
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID, -- NULL for system actions
  action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'export', 'anonymize'
  resource_type TEXT NOT NULL, -- 'clip', 'incident', 'student_data', 'metrics'
  resource_id TEXT, -- ID of the affected resource
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}', -- Additional context
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data subject rights requests (LGPD Article 18)
CREATE TABLE public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'restriction'
  data_subject_type TEXT NOT NULL,
  data_subject_id TEXT NOT NULL,
  requester_email TEXT,
  requester_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'rejected'
  response_due_date TIMESTAMPTZ, -- 15 days for LGPD
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "retention_policies_isolated" ON public.retention_policies
FOR ALL USING (org_id = current_org());

CREATE POLICY "privacy_consents_isolated" ON public.privacy_consents
FOR ALL USING (org_id = current_org());

CREATE POLICY "privacy_settings_isolated" ON public.privacy_settings
FOR ALL USING (org_id = current_org());

CREATE POLICY "audit_logs_isolated" ON public.audit_logs
FOR ALL USING (org_id = current_org());

CREATE POLICY "data_subject_requests_isolated" ON public.data_subject_requests
FOR ALL USING (org_id = current_org());

-- Service role full access
CREATE POLICY "service_role_retention_policies" ON public.retention_policies
FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_privacy_consents" ON public.privacy_consents
FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_privacy_settings" ON public.privacy_settings
FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_audit_logs" ON public.audit_logs
FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_data_subject_requests" ON public.data_subject_requests
FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Update triggers
CREATE TRIGGER update_retention_policies_updated_at
  BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_privacy_consents_updated_at
  BEFORE UPDATE ON public.privacy_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON public.privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_subject_requests_updated_at
  BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default retention policies for new orgs
INSERT INTO public.retention_policies (org_id, data_type, retention_days, legal_basis)
SELECT id, 'clips', 30, 'legitimate_interest' FROM public.orgs
WHERE NOT EXISTS (
  SELECT 1 FROM public.retention_policies 
  WHERE org_id = orgs.id AND data_type = 'clips'
);

INSERT INTO public.retention_policies (org_id, data_type, retention_days, legal_basis)
SELECT id, 'metrics', 365, 'legitimate_interest' FROM public.orgs
WHERE NOT EXISTS (
  SELECT 1 FROM public.retention_policies 
  WHERE org_id = orgs.id AND data_type = 'metrics'
);

-- Insert default privacy settings
INSERT INTO public.privacy_settings (org_id)
SELECT id FROM public.orgs
WHERE NOT EXISTS (
  SELECT 1 FROM public.privacy_settings WHERE org_id = orgs.id
);