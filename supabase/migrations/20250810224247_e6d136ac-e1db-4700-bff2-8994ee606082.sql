-- Add function to set configuration for RLS context
CREATE OR REPLACE FUNCTION public.set_config(parameter TEXT, value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config(parameter, value, false);
  RETURN value;
END;
$$;

-- Update usage_events table if missing columns
DO $$
BEGIN
  -- Check if usage_events table exists and add missing columns if needed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usage_events' 
    AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE public.usage_events ADD COLUMN stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usage_events' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.usage_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Create usage_events table if it doesn't exist
    CREATE TABLE public.usage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
      stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
      metric_type TEXT NOT NULL,
      quantity NUMERIC NOT NULL DEFAULT 0,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB DEFAULT '{}'::jsonb
    );

    -- Enable RLS
    ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

    -- RLS policies
    CREATE POLICY "usage_events_isolated" ON public.usage_events
    FOR ALL
    USING (org_id = current_org());

    CREATE POLICY "service_role_full_access_usage_events" ON public.usage_events
    FOR ALL
    USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
END;
$$;