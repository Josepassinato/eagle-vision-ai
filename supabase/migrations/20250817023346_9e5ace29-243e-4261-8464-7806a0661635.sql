-- Camera-specific AI Profiles for Quality Improvements
CREATE TABLE public.camera_ai_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID NOT NULL,
  org_id UUID NOT NULL,
  profile_name TEXT NOT NULL DEFAULT 'default',
  
  -- Detection thresholds per camera
  conf_threshold DECIMAL DEFAULT 0.5,
  nms_threshold DECIMAL DEFAULT 0.4,
  
  -- Visual normalization parameters
  brightness_gamma DECIMAL DEFAULT 1.0,
  contrast_gamma DECIMAL DEFAULT 1.0,
  exposure_compensation DECIMAL DEFAULT 0.0,
  
  -- Zone definitions (JSON array of polygons)
  interest_zones JSONB DEFAULT '[]'::JSONB,
  exclusion_zones JSONB DEFAULT '[]'::JSONB,
  
  -- Temporal smoothing settings
  hysteresis_enter_threshold DECIMAL DEFAULT 0.7,
  hysteresis_exit_threshold DECIMAL DEFAULT 0.5,
  smoothing_window_frames INTEGER DEFAULT 5,
  min_event_duration_ms INTEGER DEFAULT 1000,
  
  -- Motion gating
  motion_gate_enabled BOOLEAN DEFAULT true,
  motion_threshold DECIMAL DEFAULT 0.02,
  
  -- Class remapping and suppression
  class_mappings JSONB DEFAULT '{}'::JSONB,
  suppression_rules JSONB DEFAULT '[]'::JSONB,
  
  -- Tracker tuning per scene type
  scene_type TEXT DEFAULT 'general',
  tracker_iou_threshold DECIMAL DEFAULT 0.3,
  tracker_max_age INTEGER DEFAULT 30,
  tracker_min_hits INTEGER DEFAULT 3,
  
  -- Active profile flag
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(camera_id, profile_name, org_id)
);

-- Enable RLS
ALTER TABLE public.camera_ai_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view profiles in their org" 
ON public.camera_ai_profiles 
FOR SELECT 
USING (org_id = current_org());

CREATE POLICY "Users can create profiles in their org" 
ON public.camera_ai_profiles 
FOR INSERT 
WITH CHECK (org_id = current_org());

CREATE POLICY "Users can update profiles in their org" 
ON public.camera_ai_profiles 
FOR UPDATE 
USING (org_id = current_org());

CREATE POLICY "Users can delete profiles in their org" 
ON public.camera_ai_profiles 
FOR DELETE 
USING (org_id = current_org());

-- Enhanced detection pipeline with temporal state
CREATE TABLE public.detection_pipeline_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID NOT NULL,
  track_id TEXT NOT NULL,
  
  -- Temporal smoothing data
  confidence_history DECIMAL[] DEFAULT '{}',
  smoothed_confidence DECIMAL DEFAULT 0.0,
  frame_count INTEGER DEFAULT 0,
  
  -- Hysteresis state
  hysteresis_state TEXT DEFAULT 'idle', -- idle, entering, active, exiting
  state_enter_time TIMESTAMP WITH TIME ZONE,
  last_detection_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Motion data
  last_position DECIMAL[] DEFAULT '{}', -- [x, y, w, h]
  motion_magnitude DECIMAL DEFAULT 0.0,
  
  -- Event emission
  last_event_emitted TIMESTAMP WITH TIME ZONE,
  event_count INTEGER DEFAULT 0,
  
  org_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(camera_id, track_id, org_id)
);

-- Enable RLS for pipeline state
ALTER TABLE public.detection_pipeline_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage pipeline state in their org" 
ON public.detection_pipeline_state 
FOR ALL 
USING (org_id = current_org());

-- AI Observability metrics table
CREATE TABLE public.ai_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  camera_id UUID NOT NULL,
  org_id UUID NOT NULL,
  
  -- Performance metrics
  processing_latency_ms INTEGER,
  inference_latency_ms INTEGER,
  fps_actual DECIMAL,
  fps_target DECIMAL,
  
  -- Detection quality metrics
  confidence_avg DECIMAL,
  confidence_p50 DECIMAL,
  confidence_p95 DECIMAL,
  detection_count INTEGER DEFAULT 0,
  false_positive_rate DECIMAL,
  
  -- Class distribution
  class_distribution JSONB DEFAULT '{}'::JSONB,
  
  -- Zone metrics
  zone_coverage JSONB DEFAULT '{}'::JSONB,
  motion_activity DECIMAL DEFAULT 0.0,
  
  -- Model drift indicators
  confidence_drift DECIMAL DEFAULT 0.0,
  distribution_shift DECIMAL DEFAULT 0.0,
  
  -- Resource usage
  cpu_usage_percent DECIMAL,
  memory_usage_mb INTEGER,
  gpu_usage_percent DECIMAL,
  
  -- Aggregation period (hour, day)
  aggregation_period TEXT DEFAULT 'hour'
);

-- Enable RLS for AI metrics
ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI metrics in their org" 
ON public.ai_metrics 
FOR SELECT 
USING (org_id = current_org());

CREATE POLICY "System can insert AI metrics" 
ON public.ai_metrics 
FOR INSERT 
WITH CHECK (true); -- Allow system inserts

-- Indexes for performance
CREATE INDEX idx_ai_metrics_camera_timestamp ON public.ai_metrics(camera_id, timestamp DESC);
CREATE INDEX idx_ai_metrics_org_timestamp ON public.ai_metrics(org_id, timestamp DESC);
CREATE INDEX idx_detection_pipeline_camera ON public.detection_pipeline_state(camera_id, last_detection_time DESC);
CREATE INDEX idx_camera_ai_profiles_active ON public.camera_ai_profiles(camera_id, is_active) WHERE is_active = true;

-- Trigger for updating timestamps
CREATE TRIGGER update_camera_ai_profiles_updated_at
BEFORE UPDATE ON public.camera_ai_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_detection_pipeline_state_updated_at
BEFORE UPDATE ON public.detection_pipeline_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();