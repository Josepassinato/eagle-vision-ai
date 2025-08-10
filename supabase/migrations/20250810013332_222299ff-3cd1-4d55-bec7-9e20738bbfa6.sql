-- Step 1: ensure 'security' value exists and COMMIT separately
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security';