-- Allow public (anon) read access to active demo sources so the public demo page works
-- Adjust RLS policies on public.demo_sources

-- Drop existing SELECT policy if present to avoid conflicts
DROP POLICY IF EXISTS "demo_sources_select_auth" ON public.demo_sources;

-- Policy 1: Authenticated users can select all rows (keeps previous behavior)
CREATE POLICY "demo_sources_select_auth_all"
ON public.demo_sources
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Anonymous/public users can select only active rows
CREATE POLICY "demo_sources_select_public_active"
ON public.demo_sources
FOR SELECT
USING (active = true);