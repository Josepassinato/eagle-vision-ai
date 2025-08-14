-- Fix function search path security warnings

-- Fix calculate_clip_expiration function
CREATE OR REPLACE FUNCTION public.calculate_clip_expiration()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Set expiration based on retention_days
    NEW.expires_at = NEW.created_at + (NEW.retention_days || ' days')::INTERVAL;
    RETURN NEW;
END;
$$;

-- Fix cleanup_expired_clips function  
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