-- Step 1: Add missing columns first
ALTER TABLE public.ip_cameras 
ADD COLUMN IF NOT EXISTS network_mask TEXT;

ALTER TABLE public.ip_cameras 
ADD COLUMN IF NOT EXISTS gateway TEXT;

ALTER TABLE public.ip_cameras 
ADD COLUMN IF NOT EXISTS dns_server TEXT;

ALTER TABLE public.ip_cameras 
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT false;