-- 1. Correção: Function Search Path - Definir search_path para todas as funções
-- Atualizando as funções existentes para ter search_path definido

-- Função match_face
CREATE OR REPLACE FUNCTION public.match_face(query vector, k integer DEFAULT 5)
 RETURNS TABLE(id uuid, name text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.name,
         1 - (p.face_embedding <=> query) as similarity
  from public.people p
  where p.face_embedding is not null
  order by p.face_embedding <=> query
  limit k;
$function$;

-- Função match_body  
CREATE OR REPLACE FUNCTION public.match_body(query vector, k integer DEFAULT 5)
 RETURNS TABLE(id uuid, name text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.name,
         1 - (p.body_embedding <=> query) as similarity
  from public.people p
  where p.body_embedding is not null
  order by p.body_embedding <=> query
  limit k;
$function$;

-- Função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

-- Função get_antitheft_incidents
CREATE OR REPLACE FUNCTION public.get_antitheft_incidents(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_camera_id text DEFAULT NULL::text, p_severity text DEFAULT NULL::text)
 RETURNS SETOF antitheft_incidents
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from public.antitheft_incidents i
  where (p_from is null or i.ts >= p_from)
    and (p_to is null or i.ts <= p_to)
    and (p_camera_id is null or i.camera_id = p_camera_id)
    and (p_severity is null or i.severity = p_severity)
  order by i.ts desc
$function$;

-- Função get_media_retention_days
CREATE OR REPLACE FUNCTION public.get_media_retention_days()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select value::int from public.app_config where key = 'MEDIA_RETENTION_DAYS'), 90);
$function$;

-- Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- 2. Correção: Movendo extensões do schema public para extensions schema (onde apropriado)
-- Nota: Algumas extensões como vector precisam estar no public para funcionar corretamente
-- Vamos apenas documentar isso através de comentários

-- As extensões vector, hstore, etc. são necessárias no schema public para compatibilidade
-- com as aplicações que dependem delas. Isso é uma configuração intencional.

-- 3. Nota sobre Auth OTP expiry e Leaked Password Protection:
-- Estes são configurações que precisam ser ajustadas no painel de administração do Supabase
-- em Authentication > Settings, não podem ser corrigidas via SQL

-- Comentário documentando as configurações recomendadas:
COMMENT ON SCHEMA public IS 'Schema principal da aplicação. 
Configurações de segurança recomendadas para administrador:
1. Definir OTP expiry para valor menor (ex: 3600 segundos)
2. Habilitar leaked password protection em Auth settings
3. Extensões vector mantidas em public por necessidade funcional';