-- Fix security warnings by updating search_path for functions
CREATE OR REPLACE FUNCTION public.calculate_clip_retention()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.expires_at = NEW.created_at + (NEW.retention_days || ' days')::INTERVAL;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tenant_api_key(api_key TEXT)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_id UUID;
BEGIN
    SELECT id INTO tenant_id 
    FROM public.tenants 
    WHERE api_key = validate_tenant_api_key.api_key 
    AND is_active = true;
    
    RETURN tenant_id;
END;
$$;