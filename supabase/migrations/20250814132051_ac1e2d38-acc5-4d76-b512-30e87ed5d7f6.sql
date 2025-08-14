-- Create table for AI generated reports
CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('security', 'performance', 'incidents', 'roi')),
  time_range TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_reports
CREATE POLICY "Users can view ai_reports" 
ON public.ai_reports 
FOR SELECT 
USING (true);

CREATE POLICY "System can create ai_reports" 
ON public.ai_reports 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_reports_updated_at
BEFORE UPDATE ON public.ai_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();