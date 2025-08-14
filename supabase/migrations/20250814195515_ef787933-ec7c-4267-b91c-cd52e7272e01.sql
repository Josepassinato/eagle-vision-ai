-- Clips + Privacy + Storage Management

-- Update edge_clips table for enhanced features
ALTER TABLE public.edge_clips 
ADD COLUMN IF NOT EXISTS checksum TEXT,
ADD COLUMN IF NOT EXISTS pre_roll_seconds INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS post_roll_seconds INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS privacy_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS faces_blurred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS plates_blurred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Privacy configuration per organization
CREATE TABLE IF NOT EXISTS public.privacy_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT current_org(),
    blur_faces_by_default BOOLEAN DEFAULT true,
    blur_plates_by_default BOOLEAN DEFAULT true,
    auto_apply_privacy BOOLEAN DEFAULT true,
    retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.privacy_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policies for privacy configurations
CREATE POLICY "privacy_configs_isolated" ON public.privacy_configurations
    FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_privacy_configs" ON public.privacy_configurations  
    FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Clip processing jobs table
CREATE TABLE IF NOT EXISTS public.clip_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES public.edge_clips(id),
    org_id UUID NOT NULL DEFAULT current_org(),
    job_type TEXT NOT NULL, -- 'privacy_blur', 'checksum', 'export'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    input_params JSONB DEFAULT '{}',
    output_results JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for clip processing jobs
ALTER TABLE public.clip_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for clip processing jobs
CREATE POLICY "clip_jobs_isolated" ON public.clip_processing_jobs
    FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_clip_jobs" ON public.clip_processing_jobs
    FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Update trigger for privacy configurations
CREATE TRIGGER update_privacy_configurations_updated_at
    BEFORE UPDATE ON public.privacy_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate clip expiration
CREATE OR REPLACE FUNCTION public.calculate_clip_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- Set expiration based on retention_days
    NEW.expires_at = NEW.created_at + (NEW.retention_days || ' days')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate expiration
CREATE TRIGGER calculate_clip_expiration_trigger
    BEFORE INSERT OR UPDATE ON public.edge_clips
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_clip_expiration();

-- Function to get privacy config for organization
CREATE OR REPLACE FUNCTION public.get_privacy_config(p_org_id UUID DEFAULT current_org())
RETURNS TABLE(
    blur_faces_by_default BOOLEAN,
    blur_plates_by_default BOOLEAN,
    auto_apply_privacy BOOLEAN,
    retention_days INTEGER
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT 
        COALESCE(pc.blur_faces_by_default, true),
        COALESCE(pc.blur_plates_by_default, true), 
        COALESCE(pc.auto_apply_privacy, true),
        COALESCE(pc.retention_days, 30)
    FROM public.privacy_configurations pc
    WHERE pc.org_id = p_org_id
    UNION ALL
    SELECT true, true, true, 30  -- defaults if no config exists
    LIMIT 1;
$$;

-- Function to cleanup expired clips
CREATE OR REPLACE FUNCTION public.cleanup_expired_clips()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired clips
    DELETE FROM public.edge_clips 
    WHERE expires_at < now()
    AND upload_status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO public.audit_logs (
        action, resource_type, metadata, org_id
    ) VALUES (
        'cleanup_expired_clips',
        'edge_clips', 
        jsonb_build_object('deleted_count', deleted_count),
        current_org()
    );
    
    RETURN deleted_count;
END;
$$;

-- Insert default privacy configuration for existing orgs (if any)
INSERT INTO public.privacy_configurations (org_id, blur_faces_by_default, blur_plates_by_default, auto_apply_privacy, retention_days)
SELECT DISTINCT org_id, true, true, true, 30
FROM public.edge_clips
WHERE NOT EXISTS (
    SELECT 1 FROM public.privacy_configurations pc 
    WHERE pc.org_id = edge_clips.org_id
)
ON CONFLICT DO NOTHING;