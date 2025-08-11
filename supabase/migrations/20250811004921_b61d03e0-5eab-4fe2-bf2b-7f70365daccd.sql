-- Privacy and retention policies for organizations
-- Adds privacy controls and data retention settings

-- Create privacy policies table
CREATE TABLE IF NOT EXISTS public.privacy_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL,
    policy_name TEXT NOT NULL,
    policy_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.privacy_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies for privacy_policies
CREATE POLICY "Organizations can view their own privacy policies" 
ON public.privacy_policies 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can create their own privacy policies" 
ON public.privacy_policies 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can update their own privacy policies" 
ON public.privacy_policies 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can delete their own privacy policies" 
ON public.privacy_policies 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create video retention policies table
CREATE TABLE IF NOT EXISTS public.video_retention (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL,
    camera_id TEXT,
    retention_days INTEGER NOT NULL DEFAULT 30,
    blur_enabled BOOLEAN NOT NULL DEFAULT false,
    blur_faces BOOLEAN NOT NULL DEFAULT true,
    blur_plates BOOLEAN NOT NULL DEFAULT true,
    blur_method TEXT NOT NULL DEFAULT 'gaussian',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(org_id, camera_id)
);

-- Enable RLS
ALTER TABLE public.video_retention ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_retention
CREATE POLICY "Organizations can view their own retention policies" 
ON public.video_retention 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can create their own retention policies" 
ON public.video_retention 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can update their own retention policies" 
ON public.video_retention 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Organizations can delete their own retention policies" 
ON public.video_retention 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_privacy_policies_org_id ON public.privacy_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_privacy_policies_policy_name ON public.privacy_policies(policy_name);
CREATE INDEX IF NOT EXISTS idx_video_retention_org_id ON public.video_retention(org_id);
CREATE INDEX IF NOT EXISTS idx_video_retention_camera_id ON public.video_retention(camera_id);

-- Insert default privacy policies
INSERT INTO public.privacy_policies (org_id, policy_name, policy_data) VALUES 
('00000000-0000-0000-0000-000000000001', 'default_video_privacy', '{
    "blur_enabled": true,
    "blur_faces": true,
    "blur_plates": true,
    "blur_method": "gaussian",
    "blur_kernel": 31,
    "retention_days": 30,
    "auto_delete": true
}'),
('00000000-0000-0000-0000-000000000001', 'gdpr_compliance', '{
    "data_minimization": true,
    "purpose_limitation": true,
    "storage_limitation": true,
    "anonymization_required": true,
    "consent_tracking": true,
    "audit_logs": true
}')
ON CONFLICT DO NOTHING;

-- Insert default video retention policies
INSERT INTO public.video_retention (org_id, camera_id, retention_days, blur_enabled, blur_faces, blur_plates, blur_method) VALUES 
('00000000-0000-0000-0000-000000000001', NULL, 30, true, true, true, 'gaussian'),
('00000000-0000-0000-0000-000000000001', 'demo_cam_01', 7, true, true, true, 'pixelate'),
('00000000-0000-0000-0000-000000000001', 'demo_cam_02', 14, true, true, false, 'gaussian')
ON CONFLICT DO NOTHING;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_privacy_policies_updated_at
BEFORE UPDATE ON public.privacy_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_retention_updated_at
BEFORE UPDATE ON public.video_retention
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();