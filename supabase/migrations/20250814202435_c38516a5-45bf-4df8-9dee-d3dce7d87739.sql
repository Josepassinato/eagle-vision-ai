-- Schedule health monitoring every 5 minutes
SELECT cron.schedule(
  'health-monitoring-collect',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/health-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc1Mjc4NCwiZXhwIjoyMDcwMzI4Nzg0fQ.Y5wnlRKAzlTlZE8qT7gD_aYsQZQM4dwGx5FvN-8ZhBo"}'::jsonb,
        body:=jsonb_build_object(
          'action', 'collect',
          'orgId', 'system'
        )
    ) as request_id;
  $$
);