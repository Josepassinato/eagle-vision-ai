-- Demo catalog tables
-- 1) demo_sources and demo_bindings with RLS and seeds

-- Enable required extension for gen_random_uuid if not already
-- (Supabase generally has it, but CREATE EXTENSION IF NOT EXISTS is safe)
create extension if not exists pgcrypto;

-- Create demo_sources table
create table if not exists public.demo_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  analytic text not null, -- 'people_count','vehicle_count','alpr','safety','airport'
  url text not null,
  protocol text not null, -- 'MJPEG','JPEG_STREAM','HLS','RTSP'
  location text,
  confidence int default 60 check (confidence between 0 and 100),
  active boolean default true,
  created_at timestamptz not null default now()
);

-- Create demo_bindings table
create table if not exists public.demo_bindings (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.demo_sources(id) on delete cascade,
  service text not null,  -- 'peoplevision','vehiclevision','alpr','safetyvision','edubehavior'
  params jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_demo_sources_analytic_active
  on public.demo_sources (analytic, active);

create index if not exists idx_demo_sources_confidence
  on public.demo_sources (confidence desc);

create index if not exists idx_demo_bindings_demo
  on public.demo_bindings (demo_id);

-- Enable RLS
alter table public.demo_sources enable row level security;
alter table public.demo_bindings enable row level security;

-- Policies for demo_sources
-- Read for all authenticated users (align with many existing SELECT-any policies)
create policy if not exists demo_sources_select_auth
on public.demo_sources for select
using (auth.role() = 'authenticated');

-- Admin can insert/update/delete
create policy if not exists demo_sources_write_admin
on public.demo_sources for all
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

-- Service role can insert/update
create policy if not exists demo_sources_write_service
on public.demo_sources for insert
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

create policy if not exists demo_sources_update_service
on public.demo_sources for update
using (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Policies for demo_bindings
create policy if not exists demo_bindings_select_auth
on public.demo_bindings for select
using (auth.role() = 'authenticated');

-- Admin can write
create policy if not exists demo_bindings_write_admin
on public.demo_bindings for all
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

-- Service role can insert/update
create policy if not exists demo_bindings_insert_service
on public.demo_bindings for insert
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

create policy if not exists demo_bindings_update_service
on public.demo_bindings for update
using (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Seed data (idempotent inserts using ON CONFLICT DO NOTHING requires a unique).
-- We'll use a natural uniqueness on (name, url) by creating a unique index.
create unique index if not exists ux_demo_sources_name_url
  on public.demo_sources (name, url);

insert into public.demo_sources (name, analytic, url, protocol, location, confidence)
values
('LPL Library', 'people_count', 'https://webcam1.lpl.org/mjpg/video.mjpg','MJPEG','Lobby público', 85),
('Sparkassenplatz', 'people_count', 'https://webcam.sparkassenplatz.info/cgi-bin/faststream.jpg?stream=full&fps=25','JPEG_STREAM','Praça urbana', 80),
('MVCC RomeCam', 'people_count', 'https://romecam.mvcc.edu/mjpg/video.mjpg','MJPEG','Campus / hall', 70),
('Anklam City', 'vehicle_count', 'http://webcam.anklam.de/axis-cgi/mjpg/video.cgi','MJPEG','Centro urbano', 70),
('Satsumasendai', 'vehicle_count', 'http://camera6.city.satsumasendai.lg.jp/-wvhttp-01-/image.cgi','JPEG_STREAM','Via pública', 65),
('Larimer Lot', 'vehicle_count', 'http://htadmcam01.larimer.org/mjpg/video.mjpg','MJPEG','Estacionamento/via', 65),
('Lafarge Yard', 'safety', 'http://lafarge.sarl2e.fr:3100/mjpg/video.mjpg','MJPEG','Pátio industrial', 60),
('Paine Field', 'airport', 'https://www.youtube.com/watch?v=<id>','HLS','Aeroporto / pista', 50)
on conflict (name, url) do nothing;
