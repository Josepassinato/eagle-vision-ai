-- Create tables for advanced analytics

-- Real-time metrics storage
CREATE TABLE public.real_time_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  camera_id TEXT,
  device_id TEXT
);

-- Predictive analytics models and predictions
CREATE TABLE public.predictive_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL, -- 'anomaly_detection', 'crowd_prediction', 'incident_prediction'
  model_version TEXT NOT NULL,
  accuracy_score DOUBLE PRECISION,
  training_data_size INTEGER,
  model_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'training' -- 'training', 'active', 'deprecated'
);

CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  model_id UUID NOT NULL REFERENCES public.predictive_models(id),
  prediction_type TEXT NOT NULL,
  predicted_value DOUBLE PRECISION NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL,
  actual_value DOUBLE PRECISION,
  camera_id TEXT,
  device_id TEXT,
  prediction_data JSONB DEFAULT '{}'::jsonb,
  predicted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validated_at TIMESTAMP WITH TIME ZONE
);

-- Behavioral analytics patterns
CREATE TABLE public.behavior_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  pattern_type TEXT NOT NULL, -- 'movement', 'crowd', 'dwell_time', 'interaction'
  pattern_name TEXT NOT NULL,
  location_zone JSONB, -- geographical area or camera zone
  time_window JSONB, -- time patterns (hourly, daily, weekly)
  pattern_data JSONB NOT NULL, -- detailed pattern information
  frequency_score DOUBLE PRECISION NOT NULL, -- how often this pattern occurs
  significance_score DOUBLE PRECISION NOT NULL, -- statistical significance
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  camera_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Heat map and flow analysis data
CREATE TABLE public.heat_map_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  camera_id TEXT NOT NULL,
  zone_coordinates JSONB NOT NULL, -- x, y, width, height
  heat_intensity DOUBLE PRECISION NOT NULL, -- 0.0 to 1.0
  movement_count INTEGER NOT NULL DEFAULT 0,
  dwell_time_avg DOUBLE PRECISION DEFAULT 0, -- average time spent in seconds
  peak_hour INTEGER, -- hour of day with highest activity
  data_type TEXT NOT NULL DEFAULT 'movement', -- 'movement', 'dwell', 'interaction'
  time_bucket TIMESTAMP WITH TIME ZONE NOT NULL, -- hourly buckets
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.flow_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  camera_id TEXT NOT NULL,
  source_zone JSONB NOT NULL, -- starting coordinates
  destination_zone JSONB NOT NULL, -- ending coordinates
  flow_count INTEGER NOT NULL DEFAULT 0,
  avg_transit_time DOUBLE PRECISION, -- average time to traverse
  flow_direction TEXT, -- 'north', 'south', 'east', 'west', 'diagonal'
  time_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
  peak_flow_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for all new tables
ALTER TABLE public.real_time_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heat_map_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY "real_time_metrics_isolated" ON public.real_time_metrics
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_real_time_metrics" ON public.real_time_metrics
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "predictive_models_isolated" ON public.predictive_models
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_predictive_models" ON public.predictive_models
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "predictions_isolated" ON public.predictions
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_predictions" ON public.predictions
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "behavior_patterns_isolated" ON public.behavior_patterns
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_behavior_patterns" ON public.behavior_patterns
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "heat_map_data_isolated" ON public.heat_map_data
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_heat_map_data" ON public.heat_map_data
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "flow_analysis_isolated" ON public.flow_analysis
  FOR ALL USING (org_id = current_org());

CREATE POLICY "service_role_flow_analysis" ON public.flow_analysis
  FOR ALL USING (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'service_role'::text);

-- Add update triggers
CREATE TRIGGER update_predictive_models_updated_at
  BEFORE UPDATE ON public.predictive_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_behavior_patterns_updated_at
  BEFORE UPDATE ON public.behavior_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_real_time_metrics_timestamp ON public.real_time_metrics(timestamp);
CREATE INDEX idx_real_time_metrics_org_type ON public.real_time_metrics(org_id, metric_type);
CREATE INDEX idx_predictions_model_id ON public.predictions(model_id);
CREATE INDEX idx_predictions_timestamp ON public.predictions(predicted_at);
CREATE INDEX idx_heat_map_camera_time ON public.heat_map_data(camera_id, time_bucket);
CREATE INDEX idx_flow_analysis_camera_time ON public.flow_analysis(camera_id, time_bucket);

-- Enable realtime for real-time metrics
ALTER TABLE public.real_time_metrics REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.real_time_metrics;