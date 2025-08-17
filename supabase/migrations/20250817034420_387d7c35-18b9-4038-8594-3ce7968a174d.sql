-- Create church-specific events table
CREATE TABLE public.church_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT current_org(),
  camera_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'person_count', 'run_detected', 'fall_detected', 'intrusion_detected', 'loitering_detected', 'reach_into_bag'
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  clip_uri TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  zone_name TEXT,
  person_count INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view church events in their org" 
ON public.church_events 
FOR SELECT 
USING (org_id = current_org());

CREATE POLICY "System can insert church events" 
ON public.church_events 
FOR INSERT 
WITH CHECK (true);

-- Create church analytics table
CREATE TABLE public.church_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT current_org(),
  camera_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_attendance INTEGER DEFAULT 0,
  peak_attendance INTEGER DEFAULT 0,
  avg_attendance NUMERIC DEFAULT 0.0,
  entry_count INTEGER DEFAULT 0,
  exit_count INTEGER DEFAULT 0,
  safety_events INTEGER DEFAULT 0,
  privacy_mode_enabled BOOLEAN DEFAULT false,
  service_times JSONB DEFAULT '[]'::jsonb,
  zone_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.church_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view church analytics in their org" 
ON public.church_analytics 
FOR SELECT 
USING (org_id = current_org());

CREATE POLICY "Users can manage church analytics in their org" 
ON public.church_analytics 
FOR ALL 
USING (org_id = current_org())
WITH CHECK (org_id = current_org());

-- Create church zone configurations table
CREATE TABLE public.church_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT current_org(),
  camera_id TEXT NOT NULL,
  zone_type TEXT NOT NULL, -- 'altar', 'corridor', 'entrance', 'exit', 'restricted'
  zone_name TEXT NOT NULL,
  polygon JSONB NOT NULL, -- Array of {x, y} coordinates
  is_active BOOLEAN DEFAULT true,
  counting_enabled BOOLEAN DEFAULT false,
  privacy_level TEXT DEFAULT 'normal', -- 'normal', 'high', 'no_bio'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.church_zones ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage church zones in their org" 
ON public.church_zones 
FOR ALL 
USING (org_id = current_org())
WITH CHECK (org_id = current_org());

-- Add trigger for updated_at
CREATE TRIGGER update_church_analytics_updated_at
BEFORE UPDATE ON public.church_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_church_zones_updated_at
BEFORE UPDATE ON public.church_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_church_events_org_camera ON public.church_events(org_id, camera_id);
CREATE INDEX idx_church_events_timestamp ON public.church_events(timestamp);
CREATE INDEX idx_church_events_type ON public.church_events(event_type);
CREATE INDEX idx_church_analytics_org_date ON public.church_analytics(org_id, date);
CREATE INDEX idx_church_zones_org_camera ON public.church_zones(org_id, camera_id);