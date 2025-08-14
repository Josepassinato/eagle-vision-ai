-- Create table for report recipients
CREATE TABLE public.report_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT current_org(),
    email TEXT NOT NULL,
    phone TEXT,
    report_types TEXT[] NOT NULL DEFAULT ARRAY['daily'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_recipients ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "report_recipients_isolated" 
ON public.report_recipients 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_report_recipients" 
ON public.report_recipients 
FOR ALL 
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create table for report jobs
CREATE TABLE public.report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT current_org(),
    report_type TEXT NOT NULL,
    report_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    generated_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    recipients_count INTEGER DEFAULT 0,
    file_urls JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "report_jobs_isolated" 
ON public.report_jobs 
FOR ALL 
USING (org_id = current_org());

CREATE POLICY "service_role_report_jobs" 
ON public.report_jobs 
FOR ALL 
USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_report_recipients_updated_at
    BEFORE UPDATE ON public.report_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default recipients (admins)
INSERT INTO public.report_recipients (email, report_types)
SELECT DISTINCT 
    au.email,
    ARRAY['daily']
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;