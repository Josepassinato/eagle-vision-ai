-- Criar função para inserção segura de passos de onboarding
CREATE OR REPLACE FUNCTION public.upsert_onboarding_step(
  p_user_id UUID,
  p_step_name TEXT,
  p_completed BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_id UUID;
BEGIN
  -- Inserir ou atualizar o passo de onboarding
  INSERT INTO public.onboarding_steps (user_id, step_name, completed, completed_at)
  VALUES (
    p_user_id, 
    p_step_name, 
    p_completed,
    CASE WHEN p_completed THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, step_name) 
  DO UPDATE SET 
    completed = EXCLUDED.completed,
    completed_at = CASE WHEN EXCLUDED.completed THEN now() ELSE onboarding_steps.completed_at END
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$;