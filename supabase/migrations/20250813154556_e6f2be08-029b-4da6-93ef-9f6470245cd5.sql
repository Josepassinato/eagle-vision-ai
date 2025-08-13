-- Create tables for real analytics processing
CREATE TABLE public.frame_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frame_id text NOT NULL UNIQUE,
  camera_id text NOT NULL,
  org_id uuid NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  people_count integer DEFAULT 0,
  processing_time_ms integer NOT NULL,
  analytics_enabled text[] NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.detections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frame_id text NOT NULL,
  camera_id text NOT NULL,
  org_id uuid NOT NULL,
  service text NOT NULL,
  detection_type text NOT NULL,
  confidence float,
  bbox jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.frame_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;

-- Create policies for frame_analysis
CREATE POLICY "frame_analysis_isolated" 
ON public.frame_analysis 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_frame_analysis" 
ON public.frame_analysis 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Create policies for detections
CREATE POLICY "detections_isolated" 
ON public.detections 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_detections" 
ON public.detections 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Create indexes for performance
CREATE INDEX idx_frame_analysis_camera_timestamp ON public.frame_analysis(camera_id, timestamp DESC);
CREATE INDEX idx_frame_analysis_org_timestamp ON public.frame_analysis(org_id, timestamp DESC);
CREATE INDEX idx_detections_frame_id ON public.detections(frame_id);
CREATE INDEX idx_detections_camera_service ON public.detections(camera_id, service);
CREATE INDEX idx_detections_org_timestamp ON public.detections(org_id, created_at DESC);