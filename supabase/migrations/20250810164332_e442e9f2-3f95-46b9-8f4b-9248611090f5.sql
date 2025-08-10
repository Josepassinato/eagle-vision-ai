-- SafetyVision schema and policies (v2 - without IF NOT EXISTS in CREATE POLICY)
-- 1) Tables
create table if not exists public.safety_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text default 'America/New_York',
  created_at timestamptz default now()
);

create table if not exists public.safety_zones (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id) on delete cascade,
  label text not null,
  polygon jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.safety_policies (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id) on delete cascade,
  required_epis jsonb not null,
  thresholds jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.safety_signals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id),
  zone_id uuid references public.safety_zones(id),
  camera_id text,
  ts timestamptz not null default now(),
  type text not null,
  details jsonb,
  frame_url text
);

create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id),
  first_ts timestamptz default now(),
  last_ts timestamptz default now(),
  severity text not null,
  status text not null default 'open',
  aggregation_key text,
  signals_count int default 1,
  clip_url text,
  report_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) RLS
alter table public.safety_sites enable row level security;
alter table public.safety_zones enable row level security;
alter table public.safety_policies enable row level security;
alter table public.safety_signals enable row level security;
alter table public.safety_incidents enable row level security;

-- 3) Policies
-- Sites
drop policy if exists safety_sites_select_auth on public.safety_sites;
create policy safety_sites_select_auth on public.safety_sites for select using (auth.role() = 'authenticated');

drop policy if exists safety_sites_insert_admin on public.safety_sites;
create policy safety_sites_insert_admin on public.safety_sites for insert with check (has_role(auth.uid(), 'admin'));

drop policy if exists safety_sites_update_admin on public.safety_sites;
create policy safety_sites_update_admin on public.safety_sites for update using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- Zones
drop policy if exists safety_zones_select_auth on public.safety_zones;
create policy safety_zones_select_auth on public.safety_zones for select using (auth.role() = 'authenticated');

drop policy if exists safety_zones_insert_admin_operator_service on public.safety_zones;
create policy safety_zones_insert_admin_operator_service on public.safety_zones for insert with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

drop policy if exists safety_zones_update_admin_operator_service on public.safety_zones;
create policy safety_zones_update_admin_operator_service on public.safety_zones for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

drop policy if exists safety_zones_delete_admin on public.safety_zones;
create policy safety_zones_delete_admin on public.safety_zones for delete using (has_role(auth.uid(), 'admin'));

-- Policies
drop policy if exists safety_policies_select_auth on public.safety_policies;
create policy safety_policies_select_auth on public.safety_policies for select using (auth.role() = 'authenticated');

drop policy if exists safety_policies_insert_admin_operator_service on public.safety_policies;
create policy safety_policies_insert_admin_operator_service on public.safety_policies for insert with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

drop policy if exists safety_policies_update_admin_operator_service on public.safety_policies;
create policy safety_policies_update_admin_operator_service on public.safety_policies for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

drop policy if exists safety_policies_delete_admin on public.safety_policies;
create policy safety_policies_delete_admin on public.safety_policies for delete using (has_role(auth.uid(), 'admin'));

-- Signals
drop policy if exists safety_signals_select_auth on public.safety_signals;
create policy safety_signals_select_auth on public.safety_signals for select using (auth.role() = 'authenticated');

drop policy if exists safety_signals_insert_service on public.safety_signals;
create policy safety_signals_insert_service on public.safety_signals for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Incidents
drop policy if exists safety_incidents_select_auth on public.safety_incidents;
create policy safety_incidents_select_auth on public.safety_incidents for select using (auth.role() = 'authenticated');

drop policy if exists safety_incidents_insert_service on public.safety_incidents;
create policy safety_incidents_insert_service on public.safety_incidents for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

drop policy if exists safety_incidents_update_admin_operator_service on public.safety_incidents;
create policy safety_incidents_update_admin_operator_service on public.safety_incidents for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

-- 4) Trigger function (reuse existing)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = 'public';

-- Triggers
drop trigger if exists safety_zones_updated_at on public.safety_zones;
create trigger safety_zones_updated_at before update on public.safety_zones for each row execute function public.update_updated_at_column();

drop trigger if exists safety_policies_updated_at on public.safety_policies;
create trigger safety_policies_updated_at before update on public.safety_policies for each row execute function public.update_updated_at_column();

drop trigger if exists safety_incidents_updated_at on public.safety_incidents;
create trigger safety_incidents_updated_at before update on public.safety_incidents for each row execute function public.update_updated_at_column();

-- 5) Indexes
create index if not exists idx_safety_zones_site on public.safety_zones(site_id);
create index if not exists idx_safety_incidents_site on public.safety_incidents(site_id);
create index if not exists idx_safety_incidents_severity on public.safety_incidents(severity);
create index if not exists idx_safety_incidents_status on public.safety_incidents(status);
create index if not exists idx_safety_incidents_agg on public.safety_incidents(aggregation_key);
create index if not exists idx_safety_signals_site_ts on public.safety_signals(site_id, ts);
