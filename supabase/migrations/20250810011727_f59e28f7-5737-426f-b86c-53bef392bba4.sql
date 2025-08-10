-- Antitheft schema setup (retry without IF NOT EXISTS on policies)
-- 1) Tables
create table if not exists public.antitheft_signals (
  id bigserial primary key,
  camera_id text not null,
  ts timestamptz not null default now(),
  type text not null,
  track_id bigint,
  meta jsonb
);

create index if not exists idx_antitheft_signals_cam_ts
  on public.antitheft_signals (camera_id, ts);

create table if not exists public.antitheft_incidents (
  id bigserial primary key,
  camera_id text not null,
  ts timestamptz not null default now(),
  severity text not null check (severity in ('low','medium','high')),
  person_id uuid null,
  meta jsonb
);

create index if not exists idx_antitheft_incidents_cam_ts
  on public.antitheft_incidents (camera_id, ts);

create table if not exists public.antitheft_zones (
  id uuid primary key default gen_random_uuid(),
  camera_id text not null,
  zones jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists update_antitheft_zones_updated_at
before update on public.antitheft_zones
for each row execute function public.update_updated_at_column();

create table if not exists public.antitheft_receipts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid null,
  items jsonb not null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_antitheft_receipts_ts on public.antitheft_receipts (ts);
create index if not exists idx_antitheft_receipts_person on public.antitheft_receipts (person_id);

-- 2) RLS
alter table public.antitheft_signals enable row level security;
alter table public.antitheft_incidents enable row level security;
alter table public.antitheft_zones enable row level security;
alter table public.antitheft_receipts enable row level security;

-- signals policies
drop policy if exists signals_select_auth on public.antitheft_signals;
create policy signals_select_auth on public.antitheft_signals
for select using (auth.role() = 'authenticated');

drop policy if exists signals_insert_service on public.antitheft_signals;
create policy signals_insert_service on public.antitheft_signals
for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- incidents policies
drop policy if exists incidents_select_auth on public.antitheft_incidents;
create policy incidents_select_auth on public.antitheft_incidents
for select using (auth.role() = 'authenticated');

drop policy if exists incidents_insert_service on public.antitheft_incidents;
create policy incidents_insert_service on public.antitheft_incidents
for insert with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- zones policies (admin/operator manage, service can write)
drop policy if exists zones_select_auth on public.antitheft_zones;
create policy zones_select_auth on public.antitheft_zones
for select using (auth.role() = 'authenticated');

drop policy if exists zones_insert_admin_operator_service on public.antitheft_zones;
create policy zones_insert_admin_operator_service on public.antitheft_zones
for insert
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'operator'::app_role)
  or (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
);

drop policy if exists zones_update_admin_operator_service on public.antitheft_zones;
create policy zones_update_admin_operator_service on public.antitheft_zones
for update
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'operator'::app_role)
  or (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'operator'::app_role)
  or (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
);

drop policy if exists zones_delete_admin on public.antitheft_zones;
create policy zones_delete_admin on public.antitheft_zones
for delete using (has_role(auth.uid(), 'admin'::app_role));

-- receipts policies (admin/operator read, service/admin/operator write)
drop policy if exists receipts_select_admin_operator on public.antitheft_receipts;
create policy receipts_select_admin_operator on public.antitheft_receipts
for select using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'operator'::app_role));

drop policy if exists receipts_insert_admin_operator_service on public.antitheft_receipts;
create policy receipts_insert_admin_operator_service on public.antitheft_receipts
for insert with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'operator'::app_role)
  or (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
);

-- 3) RPC for incidents listing
create or replace function public.get_antitheft_incidents(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_camera_id text default null,
  p_severity text default null
)
returns setof public.antitheft_incidents
language sql
stable
security definer
set search_path = 'public'
as $$
  select *
  from public.antitheft_incidents i
  where (p_from is null or i.ts >= p_from)
    and (p_to is null or i.ts <= p_to)
    and (p_camera_id is null or i.camera_id = p_camera_id)
    and (p_severity is null or i.severity = p_severity)
  order by i.ts desc
$$;