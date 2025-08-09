-- Corrigir problemas de segurança das funções
-- Recriar funções com search_path seguro

create or replace function public.match_face(query vector(512), k int default 5)
returns table(id uuid, name text, similarity double precision)
language sql stable
security definer
set search_path = public
as $$
  select p.id, p.name,
         1 - (p.face_embedding <=> query) as similarity
  from public.people p
  where p.face_embedding is not null
  order by p.face_embedding <=> query
  limit k;
$$;

create or replace function public.match_body(query vector(512), k int default 5)
returns table(id uuid, name text, similarity double precision)
language sql stable
security definer  
set search_path = public
as $$
  select p.id, p.name,
         1 - (p.body_embedding <=> query) as similarity
  from public.people p
  where p.body_embedding is not null
  order by p.body_embedding <=> query
  limit k;
$$;