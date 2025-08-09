-- Card 1.5 - Configurar Supabase para Visão de Águia
-- Habilita pgvector + schema + RLS + storage

-- 1) Extensão pgvector
create extension if not exists vector;

-- 2) Tabelas
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  face_embedding vector(512),
  body_embedding vector(512),
  created_at timestamptz default now()
);

create table if not exists public.events (
  id bigserial primary key,
  camera_id text,
  person_id uuid references public.people(id) on delete set null,
  reason text, -- 'face' ou 'reid+motion'
  face_similarity double precision,
  reid_similarity double precision,
  frames_confirmed int,
  movement_px double precision,
  ts timestamptz default now()
);

-- 3) Índices vetoriais (use quantização adequada depois, p.ex. lists=100)
create index if not exists people_face_embedding_ivf
  on public.people using ivfflat (face_embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists people_body_embedding_ivf
  on public.people using ivfflat (body_embedding vector_cosine_ops)
  with (lists = 100);

-- 4) RLS
alter table public.people enable row level security;
alter table public.events enable row level security;

-- Políticas leitura autenticada
create policy ppl_select_auth on public.people
for select using (auth.role() = 'authenticated');

create policy evt_select_auth on public.events
for select using (auth.role() = 'authenticated');

-- Políticas escrita apenas service_role
create policy ppl_write_service on public.people
for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

create policy ppl_update_service on public.people
for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

create policy evt_write_service on public.events
for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- 5) Funções de busca vetorial (cosine similarity)
create or replace function public.match_face(query vector(512), k int default 5)
returns table(id uuid, name text, similarity double precision)
language sql stable as $$
  select p.id, p.name,
         1 - (p.face_embedding <=> query) as similarity
  from public.people p
  where p.face_embedding is not null
  order by p.face_embedding <=> query
  limit k;
$$;

create or replace function public.match_body(query vector(512), k int default 5)
returns table(id uuid, name text, similarity double precision)
language sql stable as $$
  select p.id, p.name,
         1 - (p.body_embedding <=> query) as similarity
  from public.people p
  where p.body_embedding is not null
  order by p.body_embedding <=> query
  limit k;
$$;

-- 6) Storage bucket para evidências (opcional)
insert into storage.buckets (id, name, public) 
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- Políticas para o bucket evidence
create policy "evidence_select_auth" on storage.objects
for select using (bucket_id = 'evidence' and auth.role() = 'authenticated');

create policy "evidence_insert_service" on storage.objects
for insert with check (
  bucket_id = 'evidence' and 
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
);