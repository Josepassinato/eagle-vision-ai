-- Step 2: Create private bucket and RLS policies for antitheft_clips

-- Create bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('antitheft_clips', 'antitheft_clips', false)
ON CONFLICT (id) DO NOTHING;

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

-- Insert: only service_role
DROP POLICY IF EXISTS "Antitheft clips insert service" ON storage.objects;
CREATE POLICY "Antitheft clips insert service"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'antitheft_clips'
  AND ((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'
);

-- Update: only service_role (allow overwrite)
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
