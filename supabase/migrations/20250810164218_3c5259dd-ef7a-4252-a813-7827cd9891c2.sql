-- SafetyVision schema and policies
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
  label text not null, -- 'restricted','critical','general'
  polygon jsonb not null, -- store GeoJSON
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.safety_policies (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id) on delete cascade,
  required_epis jsonb not null, -- {"helmet":true,...}
  thresholds jsonb not null,    -- {"posture_tau":0.65,"immobility_s":8}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.safety_signals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id),
  zone_id uuid references public.safety_zones(id),
  camera_id text,
  ts timestamptz not null default now(),
  type text not null,  -- 'missing_ppe','unauthorized_zone','unsafe_lifting','fall_suspected'
  details jsonb,
  frame_url text
);

create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.safety_sites(id),
  first_ts timestamptz default now(),
  last_ts timestamptz default now(),
  severity text not null,  -- 'LOW','MEDIUM','HIGH','CRITICAL'
  status text not null default 'open', -- 'open','ack','closed'
  aggregation_key text,
  signals_count int default 1,
  clip_url text,
  report_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Row Level Security
alter table public.safety_sites enable row level security;
alter table public.safety_zones enable row level security;
alter table public.safety_policies enable row level security;
alter table public.safety_signals enable row level security;
alter table public.safety_incidents enable row level security;

-- 3) Policies (pattern consistent with existing tables)
-- Sites
create policy if not exists safety_sites_select_auth on public.safety_sites for select using (auth.role() = 'authenticated');
create policy if not exists safety_sites_insert_admin on public.safety_sites for insert with check (has_role(auth.uid(), 'admin'));
create policy if not exists safety_sites_update_admin on public.safety_sites for update using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

-- Zones
create policy if not exists safety_zones_select_auth on public.safety_zones for select using (auth.role() = 'authenticated');
create policy if not exists safety_zones_insert_admin_operator_service on public.safety_zones for insert with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);
create policy if not exists safety_zones_update_admin_operator_service on public.safety_zones for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);
create policy if not exists safety_zones_delete_admin on public.safety_zones for delete using (has_role(auth.uid(), 'admin'));

-- Policies
create policy if not exists safety_policies_select_auth on public.safety_policies for select using (auth.role() = 'authenticated');
create policy if not exists safety_policies_insert_admin_operator_service on public.safety_policies for insert with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);
create policy if not exists safety_policies_update_admin_operator_service on public.safety_policies for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);
create policy if not exists safety_policies_delete_admin on public.safety_policies for delete using (has_role(auth.uid(), 'admin'));

-- Signals (event-like)
create policy if not exists safety_signals_select_auth on public.safety_signals for select using (auth.role() = 'authenticated');
create policy if not exists safety_signals_insert_service on public.safety_signals for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Incidents
create policy if not exists safety_incidents_select_auth on public.safety_incidents for select using (auth.role() = 'authenticated');
create policy if not exists safety_incidents_insert_service on public.safety_incidents for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
create policy if not exists safety_incidents_update_admin_operator_service on public.safety_incidents for update using (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
) with check (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

-- 4) Simple timestamp update trigger function (reuse if exists)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = 'public';

-- Triggers
create trigger safety_zones_updated_at before update on public.safety_zones for each row execute function public.update_updated_at_column();
create trigger safety_policies_updated_at before update on public.safety_policies for each row execute function public.update_updated_at_column();
create trigger safety_incidents_updated_at before update on public.safety_incidents for each row execute function public.update_updated_at_column();

-- 5) Helpful indexes
create index if not exists idx_safety_zones_site on public.safety_zones(site_id);
create index if not exists idx_safety_incidents_site on public.safety_incidents(site_id);
create index if not exists idx_safety_incidents_severity on public.safety_incidents(severity);
create index if not exists idx_safety_incidents_status on public.safety_incidents(status);
create index if not exists idx_safety_incidents_agg on public.safety_incidents(aggregation_key);
create index if not exists idx_safety_signals_site_ts on public.safety_signals(site_id, ts);
