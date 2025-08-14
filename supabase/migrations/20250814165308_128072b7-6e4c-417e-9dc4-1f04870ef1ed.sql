-- Fix security warning: Function Search Path Mutable
-- Update functions to have proper security settings

-- Update trigger_webhooks function
CREATE OR REPLACE FUNCTION public.trigger_webhooks(_event_type text, _payload jsonb)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;

-- Update log_integration_sync function
CREATE OR REPLACE FUNCTION public.log_integration_sync(_integration_id uuid, _sync_type text, _status text, _records_processed integer DEFAULT 0, _error_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  INSERT INTO public.integration_sync_logs (
    integration_id, sync_type, status, records_processed, 
    error_details, org_id
  ) VALUES (
    _integration_id, _sync_type, _status, _records_processed,
    _error_details, current_org()
  )
  RETURNING id;
$function$;

-- Update log_data_access function
CREATE OR REPLACE FUNCTION public.log_data_access(_access_type text, _resource_type text, _resource_id text DEFAULT NULL::text, _data_subject_id text DEFAULT NULL::text, _purpose text DEFAULT NULL::text, _legal_basis text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  INSERT INTO public.data_access_logs (
    user_id, access_type, resource_type, resource_id, 
    data_subject_id, purpose, legal_basis
  ) VALUES (
    auth.uid(), _access_type, _resource_type, _resource_id,
    _data_subject_id, _purpose, _legal_basis
  )
  RETURNING id;
$function$;