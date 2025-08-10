-- Fix security warnings for helper functions

-- Fix current_org function with proper search_path
CREATE OR REPLACE FUNCTION public.current_org() 
RETURNS UUID 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(current_setting('request.org_id', true), '')::UUID
$$;

-- Fix user_belongs_to_org function with proper search_path  
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(user_id UUID, org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users 
    WHERE org_users.user_id = user_belongs_to_org.user_id 
    AND org_users.org_id = user_belongs_to_org.org_id
  )
$$;