-- MULTI-TENANT ARCHITECTURE WITH ORG ISOLATION (Fixed)

-- ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ORG API KEYS (for API authentication)
CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  secret TEXT NOT NULL, -- store hash, not plaintext
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- ORG USERS (many-to-many relationship between orgs and users)
CREATE TABLE IF NOT EXISTS public.org_users (
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- reference to auth.users
  role TEXT NOT NULL DEFAULT 'member', -- owner | admin | analyst | viewer
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Update existing cameras table to include org_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cameras' AND column_name = 'org_id') THEN
    ALTER TABLE public.cameras ADD COLUMN org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- STREAMS (camera analytics configuration) - using TEXT camera_id to match existing cameras table
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  camera_id TEXT NOT NULL, -- matches cameras.id which is TEXT
  analytic TEXT NOT NULL, -- peoplevision | vehiclevision | safetyvision | edubehavior | alpr
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SIGNALS (real-time events from analytics)
CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL, -- LOW | MEDIUM | HIGH | CRITICAL
  details JSONB,
  frame_url TEXT
);

-- INCIDENTS (aggregated signals)
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  first_ts TIMESTAMPTZ DEFAULT now(),
  last_ts TIMESTAMPTZ DEFAULT now(),
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | ack | closed
  signals_count INT DEFAULT 1,
  clip_url TEXT,
  report_url TEXT
);

-- USAGE TRACKING (for billing)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  analytic TEXT NOT NULL,
  minutes INT NOT NULL, -- processed minutes in this interval
  frames INT DEFAULT 0,
  storage_mb INT DEFAULT 0,
  ts_start TIMESTAMPTZ NOT NULL,
  ts_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QUOTAS (plan limits)
CREATE TABLE IF NOT EXISTS public.quotas (
  org_id UUID PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  max_streams INT NOT NULL DEFAULT 2,
  max_storage_gb INT NOT NULL DEFAULT 10,
  max_minutes_month INT NOT NULL DEFAULT 2000,
  overage_allowed BOOLEAN DEFAULT true
);

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTION: Get current org from request context
CREATE OR REPLACE FUNCTION public.current_org() 
RETURNS UUID 
LANGUAGE SQL 
STABLE 
AS $$
  SELECT NULLIF(current_setting('request.org_id', true), '')::UUID
$$;

-- HELPER FUNCTION: Check if user belongs to org
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(user_id UUID, org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users 
    WHERE org_users.user_id = user_belongs_to_org.user_id 
    AND org_users.org_id = user_belongs_to_org.org_id
  )
$$;

-- RLS POLICIES: Isolate data by org_id
CREATE POLICY "orgs_isolated" ON public.orgs 
  FOR ALL USING (id = current_org());

CREATE POLICY "api_keys_isolated" ON public.org_api_keys 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "org_users_isolated" ON public.org_users 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "cameras_isolated" ON public.cameras 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "streams_isolated" ON public.streams 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "signals_isolated" ON public.signals 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "incidents_isolated" ON public.incidents 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "usage_isolated" ON public.usage_events 
  FOR ALL USING (org_id = current_org());

CREATE POLICY "quotas_isolated" ON public.quotas 
  FOR ALL USING (org_id = current_org());

-- Additional policies for authenticated users
CREATE POLICY "org_users_can_read_own_orgs" ON public.org_users
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "users_can_read_their_orgs" ON public.orgs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_users 
    WHERE org_users.org_id = orgs.id 
    AND org_users.user_id = auth.uid()
  ));

-- Service role policies for API access
CREATE POLICY "service_role_full_access" ON public.orgs
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_api_keys" ON public.org_api_keys
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_org_users" ON public.org_users
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_streams" ON public.streams
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_signals" ON public.signals
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_incidents" ON public.incidents
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_usage" ON public.usage_events
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "service_role_full_access_quotas" ON public.quotas
  FOR ALL 
  USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- SEED DATA: Create demo organization
INSERT INTO public.orgs (name, plan) 
VALUES ('Demo Organization', 'starter') 
ON CONFLICT DO NOTHING;

-- Create quotas for demo org
INSERT INTO public.quotas (org_id, max_streams, max_storage_gb, max_minutes_month)
SELECT id, 4, 20, 5000 
FROM public.orgs 
WHERE name = 'Demo Organization'
ON CONFLICT (org_id) DO NOTHING;