-- Criar tabela para configurações de DVR
CREATE TABLE public.dvr_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 554,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  channel INTEGER NOT NULL DEFAULT 1,
  stream_quality TEXT NOT NULL DEFAULT 'main',
  transport_protocol TEXT NOT NULL DEFAULT 'tcp',
  stream_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_tested_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dvr_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dvr_configs_isolated" 
ON public.dvr_configs 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_dvr_configs" 
ON public.dvr_configs 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Trigger para updated_at
CREATE TRIGGER update_dvr_configs_updated_at
  BEFORE UPDATE ON public.dvr_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_dvr_configs_org_id ON public.dvr_configs(org_id);
CREATE INDEX idx_dvr_configs_status ON public.dvr_configs(status);
CREATE INDEX idx_dvr_configs_host ON public.dvr_configs(host);