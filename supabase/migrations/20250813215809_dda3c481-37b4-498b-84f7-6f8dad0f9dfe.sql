-- Criar tabela para logs de analytics de stream
CREATE TABLE IF NOT EXISTS public.stream_analytics_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  analytics_modules TEXT[] DEFAULT '{}',
  action TEXT NOT NULL CHECK (action IN ('started', 'stopped')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stream_analytics_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for stream analytics logs
CREATE POLICY "Users can view their own stream logs" 
ON public.stream_analytics_logs 
FOR SELECT 
USING (org_id = current_org() OR org_id IS NULL);

CREATE POLICY "Users can create stream logs" 
ON public.stream_analytics_logs 
FOR INSERT 
WITH CHECK (org_id = current_org() OR org_id IS NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_stream_analytics_logs_camera_id ON public.stream_analytics_logs(camera_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_logs_timestamp ON public.stream_analytics_logs(timestamp DESC);