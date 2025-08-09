-- Create table for storing multiple face views per person
CREATE TABLE IF NOT EXISTS public.people_faces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.people_faces ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'people_faces' AND policyname = 'pfaces_select_auth'
  ) THEN
    CREATE POLICY "pfaces_select_auth"
    ON public.people_faces
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- Policies: service role can INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'people_faces' AND policyname = 'pfaces_write_service'
  ) THEN
    CREATE POLICY "pfaces_write_service"
    ON public.people_faces
    FOR INSERT
    WITH CHECK (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
  END IF;
END$$;

-- Policies: service role can DELETE (to remove last view if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'people_faces' AND policyname = 'pfaces_delete_service'
  ) THEN
    CREATE POLICY "pfaces_delete_service"
    ON public.people_faces
    FOR DELETE
    USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
  END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_people_faces_person_id ON public.people_faces (person_id);
