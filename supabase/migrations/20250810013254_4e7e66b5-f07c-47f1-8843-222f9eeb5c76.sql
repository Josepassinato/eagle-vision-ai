-- Ensure 'security' role exists in enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    -- If enum doesn't exist (unlikely in this project), create with common roles
    CREATE TYPE public.app_role AS ENUM ('admin','operator','security','user');
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- ignore
END$$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security';

-- Create private bucket for antitheft clips
INSERT INTO storage.buckets (id, name, public)
VALUES ('antitheft_clips', 'antitheft_clips', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects scoped to antitheft_clips bucket
-- Read: only authenticated users with role admin or security
DROP POLICY IF EXISTS "Antitheft clips read admin/security" ON storage.objects;
CREATE POLICY "Antitheft clips read admin/security"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'antitheft_clips'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'security'::app_role)
  )
);

-- Insert: only service_role (backend services)
DROP POLICY IF EXISTS "Antitheft clips insert service" ON storage.objects;
CREATE POLICY "Antitheft clips insert service"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'antitheft_clips'
  AND ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

-- Update: only service_role (allow overwrites)
DROP POLICY IF EXISTS "Antitheft clips update service" ON storage.objects;
CREATE POLICY "Antitheft clips update service"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'antitheft_clips'
  AND ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
)
WITH CHECK (
  bucket_id = 'antitheft_clips'
  AND ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

-- Delete: only admin
DROP POLICY IF EXISTS "Antitheft clips delete admin" ON storage.objects;
CREATE POLICY "Antitheft clips delete admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'antitheft_clips'
  AND has_role(auth.uid(), 'admin'::app_role)
);
