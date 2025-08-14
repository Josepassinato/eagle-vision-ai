-- Fix remaining security warnings for Function Search Path Mutable
-- Update remaining functions to have proper security settings

-- Update set_config function
CREATE OR REPLACE FUNCTION public.set_config(parameter text, value text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  PERFORM set_config(parameter, value, false);
  RETURN value;
END;
$function$;

-- Update get_user_trial_credits function
CREATE OR REPLACE FUNCTION public.get_user_trial_credits(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(credits_remaining integer, trial_days_left integer, trial_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    GREATEST(0, tc.credits_granted - tc.credits_used) as credits_remaining,
    GREATEST(0, EXTRACT(days FROM tc.trial_end - now())::INTEGER) as trial_days_left,
    (tc.trial_end > now() AND tc.credits_granted > tc.credits_used) as trial_active
  FROM public.trial_credits tc
  WHERE tc.user_id = p_user_id;
$function$;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, company_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa')
  );
  
  -- Grant trial credits
  INSERT INTO public.trial_credits (user_id, credits_granted, trial_start, trial_end)
  VALUES (
    NEW.id,
    100,
    now(),
    now() + INTERVAL '7 days'
  );
  
  RETURN NEW;
END;
$function$;