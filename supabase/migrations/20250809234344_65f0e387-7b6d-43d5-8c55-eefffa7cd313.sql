-- Create storage bucket for event clips (private by default -> we'll use public=true for shareable links)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event_clips', 'event_clips', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for event_clips
DO $$
BEGIN
  -- Public read for clips (shareable links)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'clips_public_read'
  ) THEN
    CREATE POLICY "clips_public_read"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'event_clips');
  END IF;

  -- Service role can insert new clips
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'clips_insert_service'
  ) THEN
    CREATE POLICY "clips_insert_service"
      ON storage.objects
      FOR INSERT
      TO public
      WITH CHECK (
        bucket_id = 'event_clips' AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  -- Service role can update/overwrite clips
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'clips_update_service'
  ) THEN
    CREATE POLICY "clips_update_service"
      ON storage.objects
      FOR UPDATE
      TO public
      USING (
        bucket_id = 'event_clips' AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      )
      WITH CHECK (
        bucket_id = 'event_clips' AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  -- Admins can delete clips
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'clips_delete_admin'
  ) THEN
    CREATE POLICY "clips_delete_admin"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'event_clips' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;