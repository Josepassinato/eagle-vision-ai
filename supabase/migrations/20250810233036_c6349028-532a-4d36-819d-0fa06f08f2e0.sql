-- Create service_policies table for dynamic configuration
CREATE TABLE IF NOT EXISTS public.service_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES public.orgs(id),
    camera_id TEXT,
    class_id UUID,
    site_id TEXT,
    service_name TEXT NOT NULL,
    policy_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure unique policy per scope
    UNIQUE(org_id, camera_id, class_id, site_id, policy_type)
);

-- Enable RLS
ALTER TABLE public.service_policies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_policies_isolated" ON public.service_policies
FOR ALL USING (org_id = current_org());

CREATE POLICY "service_policies_service_access" ON public.service_policies
FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Create indexes
CREATE INDEX idx_service_policies_lookup ON public.service_policies(policy_type, org_id, camera_id, class_id, site_id);
CREATE INDEX idx_service_policies_updated ON public.service_policies(updated_at);

-- Create trigger for updated_at
CREATE TRIGGER update_service_policies_updated_at
BEFORE UPDATE ON public.service_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();