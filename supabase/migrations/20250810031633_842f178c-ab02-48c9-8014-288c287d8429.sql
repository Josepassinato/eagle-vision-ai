-- Fix function body quoting
create or replace function public.get_media_retention_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value::int from public.app_config where key = 'MEDIA_RETENTION_DAYS'), 90);
$$;