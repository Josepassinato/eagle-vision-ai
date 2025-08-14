-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily report generation at 7 AM UTC (4 AM BR time) every day
SELECT cron.schedule(
  'daily-security-report',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/daily-report-generator',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc1Mjc4NCwiZXhwIjoyMDcwMzI4Nzg0fQ.Y5wnlRKAzlTlZE8qT7gD_aYsQZQM4dwGx5FvN-8ZhBo"}'::jsonb,
        body:=jsonb_build_object(
          'reportDate', (CURRENT_DATE - INTERVAL '1 day')::text,
          'orgId', 'system'
        )
    ) as request_id;
  $$
);