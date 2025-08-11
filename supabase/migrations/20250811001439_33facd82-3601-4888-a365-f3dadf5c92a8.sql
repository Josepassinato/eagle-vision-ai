-- RLS and Multi-tenancy Setup
-- Add org_id to all operational tables and enable RLS

-- Add org_id to cameras table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cameras' AND column_name = 'org_id') THEN
        ALTER TABLE public.cameras ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to events table if not exists  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'org_id') THEN
        ALTER TABLE public.events ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to antitheft_signals table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'antitheft_signals' AND column_name = 'org_id') THEN
        ALTER TABLE public.antitheft_signals ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to antitheft_incidents table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'antitheft_incidents' AND column_name = 'org_id') THEN
        ALTER TABLE public.antitheft_incidents ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to edu_signals table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edu_signals' AND column_name = 'org_id') THEN
        ALTER TABLE public.edu_signals ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to edu_incidents table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edu_incidents' AND column_name = 'org_id') THEN
        ALTER TABLE public.edu_incidents ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Add org_id to people table if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'people' AND column_name = 'org_id') THEN
        ALTER TABLE public.people ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Create safety_signals table for SafetyVision
CREATE TABLE IF NOT EXISTS public.safety_signals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL,
    camera_id TEXT NOT NULL,
    track_id TEXT,
    type TEXT NOT NULL, -- 'missing_ppe', 'fall_suspected', 'unsafe_lifting'
    severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    details JSONB,
    ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    bbox JSONB, -- bounding box coordinates
    confidence REAL,
    ppe_type TEXT, -- for PPE violations
    risk_factors JSONB -- for posture/fall analysis
);

-- Create safety_incidents table
CREATE TABLE IF NOT EXISTS public.safety_incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    signals_count INTEGER DEFAULT 1,
    first_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
    camera_id TEXT,
    track_id TEXT,
    incident_type TEXT NOT NULL,
    clip_url TEXT,
    notes TEXT
);

-- Enable RLS on new tables
ALTER TABLE public.safety_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for safety tables
CREATE POLICY "safety_signals_isolated" ON public.safety_signals
    FOR ALL USING (org_id = current_org());

CREATE POLICY "safety_incidents_isolated" ON public.safety_incidents  
    FOR ALL USING (org_id = current_org());

-- Service role access for safety tables
CREATE POLICY "service_role_safety_signals" ON public.safety_signals
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "service_role_safety_incidents" ON public.safety_incidents
    FOR ALL TO service_role  
    USING (true);

-- Update existing RLS policies to use org_id isolation where missing
-- Events table
DROP POLICY IF EXISTS "evt_select_auth" ON public.events;
CREATE POLICY "events_isolated" ON public.events
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

CREATE POLICY "service_role_events" ON public.events
    FOR ALL TO service_role
    USING (true);

-- Antitheft signals  
DROP POLICY IF EXISTS "signals_select_auth" ON public.antitheft_signals;
CREATE POLICY "antitheft_signals_isolated" ON public.antitheft_signals
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

-- Antitheft incidents
DROP POLICY IF EXISTS "incidents_select_auth" ON public.antitheft_incidents;  
CREATE POLICY "antitheft_incidents_isolated" ON public.antitheft_incidents
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

-- Edu signals
DROP POLICY IF EXISTS "edu_signals_select_auth" ON public.edu_signals;
CREATE POLICY "edu_signals_isolated" ON public.edu_signals
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

-- Edu incidents  
DROP POLICY IF EXISTS "edu_incidents_select_auth" ON public.edu_incidents;
CREATE POLICY "edu_incidents_isolated" ON public.edu_incidents
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

-- People table
DROP POLICY IF EXISTS "ppl_select_auth" ON public.people;
CREATE POLICY "people_isolated" ON public.people
    FOR ALL USING (
        CASE 
            WHEN org_id IS NOT NULL THEN org_id = current_org()
            ELSE auth.role() = 'authenticated'
        END
    );

-- Function to set org_id based on API key
CREATE OR REPLACE FUNCTION public.set_org_from_api_key()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    api_key_header text;
    org_uuid uuid;
BEGIN
    -- Get API key from request headers
    api_key_header := current_setting('request.headers', true)::json->>'x-api-key';
    
    IF api_key_header IS NOT NULL THEN
        -- Look up org_id from API key
        SELECT org_id INTO org_uuid 
        FROM public.org_api_keys 
        WHERE secret = api_key_header;
        
        IF org_uuid IS NOT NULL THEN
            -- Set org_id for this session
            PERFORM set_config('request.org_id', org_uuid::text, false);
        END IF;
    END IF;
END;
$function$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safety_signals_org_camera ON public.safety_signals(org_id, camera_id, ts);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_org_status ON public.safety_incidents(org_id, status, incident_type);
CREATE INDEX IF NOT EXISTS idx_events_org_camera ON public.events(org_id, camera_id, ts) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_antitheft_signals_org_camera ON public.antitheft_signals(org_id, camera_id, ts) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edu_signals_org_class ON public.edu_signals(org_id, class_id, ts) WHERE org_id IS NOT NULL;