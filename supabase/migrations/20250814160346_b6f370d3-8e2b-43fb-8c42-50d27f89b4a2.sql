-- Create comprehensive enterprise integrations tables

-- Webhook configurations
CREATE TABLE IF NOT EXISTS public.webhook_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  auth_type TEXT, -- 'none', 'bearer', 'basic', 'api_key'
  auth_config JSONB DEFAULT '{}',
  event_types TEXT[] NOT NULL, -- array of event types to trigger webhook
  is_active BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook execution logs
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  webhook_id UUID NOT NULL REFERENCES public.webhook_configurations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  error_message TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Integration configurations (Teams, Slack, CRM, etc.)
CREATE TABLE IF NOT EXISTS public.integration_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  integration_type TEXT NOT NULL, -- 'teams', 'slack', 'salesforce', 'hubspot', 'custom'
  name TEXT NOT NULL,
  configuration JSONB NOT NULL, -- stored encrypted credentials and settings
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, integration_type, name)
);

-- SSO/SAML configurations
CREATE TABLE IF NOT EXISTS public.sso_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL, -- 'saml', 'oidc', 'oauth2'
  sso_url TEXT NOT NULL,
  entity_id TEXT,
  certificate TEXT,
  attribute_mapping JSONB DEFAULT '{}', -- map SAML attributes to user fields
  auto_provision BOOLEAN DEFAULT false,
  default_role app_role DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider_name)
);

-- Integration sync logs
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  integration_id UUID NOT NULL REFERENCES public.integration_configurations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'webhook'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Notification channels (Teams/Slack channels)
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  integration_id UUID NOT NULL REFERENCES public.integration_configurations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL, -- 'teams', 'slack'
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  webhook_url TEXT,
  notification_types TEXT[] NOT NULL, -- types of notifications to send
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enterprise users (for SSO mapping)
CREATE TABLE IF NOT EXISTS public.enterprise_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID DEFAULT current_org(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sso_provider_id UUID REFERENCES public.sso_configurations(id) ON DELETE SET NULL,
  external_user_id TEXT, -- ID from SSO provider
  external_attributes JSONB DEFAULT '{}',
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, external_user_id, sso_provider_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY "webhook_configurations_org_access" ON public.webhook_configurations
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "webhook_logs_org_access" ON public.webhook_logs
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "integration_configurations_org_access" ON public.integration_configurations
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "sso_configurations_org_access" ON public.sso_configurations
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "integration_sync_logs_org_access" ON public.integration_sync_logs
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "notification_channels_org_access" ON public.notification_channels
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

CREATE POLICY "enterprise_users_org_access" ON public.enterprise_users
  FOR ALL USING (org_id IS NULL OR org_id = current_org());

-- Service role policies for automated systems
CREATE POLICY "service_role_webhook_configurations" ON public.webhook_configurations
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_webhook_logs" ON public.webhook_logs
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_integration_configurations" ON public.integration_configurations
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_sso_configurations" ON public.sso_configurations
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_integration_sync_logs" ON public.integration_sync_logs
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_notification_channels" ON public.notification_channels
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

CREATE POLICY "service_role_enterprise_users" ON public.enterprise_users
  FOR ALL USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create update triggers
CREATE TRIGGER update_webhook_configurations_updated_at
  BEFORE UPDATE ON public.webhook_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_configurations_updated_at
  BEFORE UPDATE ON public.integration_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sso_configurations_updated_at
  BEFORE UPDATE ON public.sso_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enterprise_users_updated_at
  BEFORE UPDATE ON public.enterprise_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to trigger webhooks
CREATE OR REPLACE FUNCTION public.trigger_webhooks(
  _event_type TEXT,
  _payload JSONB
)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.webhook_logs (webhook_id, event_type, payload, org_id)
  SELECT 
    id, 
    _event_type, 
    _payload,
    org_id
  FROM public.webhook_configurations 
  WHERE is_active = true 
    AND _event_type = ANY(event_types)
    AND (org_id IS NULL OR org_id = current_org())
  RETURNING (SELECT COUNT(*) FROM webhook_configurations WHERE is_active = true AND _event_type = ANY(event_types));
$$;

-- Create function to log integration sync
CREATE OR REPLACE FUNCTION public.log_integration_sync(
  _integration_id UUID,
  _sync_type TEXT,
  _status TEXT,
  _records_processed INTEGER DEFAULT 0,
  _error_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.integration_sync_logs (
    integration_id, sync_type, status, records_processed, 
    error_details, org_id
  ) VALUES (
    _integration_id, _sync_type, _status, _records_processed,
    _error_details, current_org()
  )
  RETURNING id;
$$;