-- Demo catalog tables (retry without IF NOT EXISTS on policies)
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.demo_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  analytic text not null,
  url text not null,
  protocol text not null,
  location text,
  confidence int default 60 check (confidence between 0 and 100),
  active boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_bindings (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.demo_sources(id) on delete cascade,
  service text not null,
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

-- RLS
alter table public.demo_sources enable row level security;
alter table public.demo_bindings enable row level security;

-- Policies: drop then create
-- demo_sources
drop policy if exists demo_sources_select_auth on public.demo_sources;
create policy demo_sources_select_auth
on public.demo_sources for select
using (auth.role() = 'authenticated');

drop policy if exists demo_sources_write_admin on public.demo_sources;
create policy demo_sources_write_admin
on public.demo_sources for all
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

drop policy if exists demo_sources_write_service on public.demo_sources;
create policy demo_sources_write_service
on public.demo_sources for insert
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

drop policy if exists demo_sources_update_service on public.demo_sources;
create policy demo_sources_update_service
on public.demo_sources for update
using (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- demo_bindings
drop policy if exists demo_bindings_select_auth on public.demo_bindings;
create policy demo_bindings_select_auth
on public.demo_bindings for select
using (auth.role() = 'authenticated');

drop policy if exists demo_bindings_write_admin on public.demo_bindings;
create policy demo_bindings_write_admin
on public.demo_bindings for all
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

drop policy if exists demo_bindings_insert_service on public.demo_bindings;
create policy demo_bindings_insert_service
on public.demo_bindings for insert
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

drop policy if exists demo_bindings_update_service on public.demo_bindings;
create policy demo_bindings_update_service
on public.demo_bindings for update
using (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Seed
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