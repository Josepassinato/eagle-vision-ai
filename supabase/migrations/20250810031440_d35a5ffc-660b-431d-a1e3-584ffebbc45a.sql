-- Enable required extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Make event_clips bucket private
update storage.buckets set public = false where id = 'event_clips';

-- Drop public read policy for event_clips if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'clips_public_read'
  ) THEN
    EXECUTE 'DROP POLICY "clips_public_read" ON storage.objects';
  END IF;
END $$;

-- Ensure authenticated can create signed URLs by allowing SELECT on event_clips objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'event_clips_read_authenticated'
  ) THEN
    EXECUTE $$
      CREATE POLICY "event_clips_read_authenticated"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'event_clips');
    $$;
  END IF;
END $$;

-- App config table for retention days
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Seed default retention if missing
insert into public.app_config (key, value)
values ('MEDIA_RETENTION_DAYS', '90')
on conflict (key) do nothing;

-- Helper function to read retention days
create or replace function public.get_media_retention_days()
returns integer
language sql
stable
as $$
  select coalesce((select value::int from public.app_config where key = 'MEDIA_RETENTION_DAYS'), 90);
$$;

-- Schedule daily cleanup via Edge Function using pg_cron + pg_net
-- The Edge Function 'media-cleanup' will use SERVICE_ROLE to delete old files.
select
  cron.schedule(
    'daily-media-cleanup',
    '15 3 * * *',
    $$
    select net.http_post(
      url := 'https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/media-cleanup',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTI3ODQsImV4cCI6MjA3MDMyODc4NH0.fmpP6MWxsz-GYT44mAvBfR5rXIFdR-PoUbswzkeClo4'
      ),
      body := jsonb_build_object(
        'retention_days', public.get_media_retention_days()
      )
    );
    $$
  );