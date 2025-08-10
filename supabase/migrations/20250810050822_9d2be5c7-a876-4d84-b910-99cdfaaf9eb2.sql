-- Credits ledger for pay-per-event model
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null, -- positive for purchases, negative for consumption
  description text,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy if not exists "Users can view own credits"
  on public.credit_ledger
  for select
  using (auth.uid() = user_id);

create policy if not exists "Service can write credits"
  on public.credit_ledger
  for insert
  with check (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

create policy if not exists "Service can delete credits"
  on public.credit_ledger
  for delete
  using (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

create index if not exists idx_credit_ledger_user_created on public.credit_ledger(user_id, created_at desc);
