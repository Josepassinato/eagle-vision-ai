-- 1) Roles enum + user_roles table + helper function
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- RLS for user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_select_self_or_admin'
  ) THEN
    CREATE POLICY "user_roles_select_self_or_admin"
      ON public.user_roles
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_insert_admin'
  ) THEN
    CREATE POLICY "user_roles_insert_admin"
      ON public.user_roles
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_update_admin'
  ) THEN
    CREATE POLICY "user_roles_update_admin"
      ON public.user_roles
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_delete_admin'
  ) THEN
    CREATE POLICY "user_roles_delete_admin"
      ON public.user_roles
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- 2) Utility trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Cameras table
CREATE TABLE IF NOT EXISTS public.cameras (
  id text PRIMARY KEY,
  name text,
  stream_url text,
  online boolean NOT NULL DEFAULT false,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Policies for cameras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cameras' AND policyname = 'cams_select_auth'
  ) THEN
    CREATE POLICY "cams_select_auth"
      ON public.cameras
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cameras' AND policyname = 'cams_write_admin'
  ) THEN
    CREATE POLICY "cams_write_admin"
      ON public.cameras
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  -- service role can insert/update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cameras' AND policyname = 'cams_write_service'
  ) THEN
    CREATE POLICY "cams_write_service"
      ON public.cameras
      FOR INSERT
      TO public
      WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cameras' AND policyname = 'cams_update_service'
  ) THEN
    CREATE POLICY "cams_update_service"
      ON public.cameras
      FOR UPDATE
      TO public
      USING ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'))
      WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));
  END IF;
END$$;

-- Trigger for cameras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cameras_updated_at'
  ) THEN
    CREATE TRIGGER trg_cameras_updated_at
      BEFORE UPDATE ON public.cameras
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 4) Camera configs
CREATE TABLE IF NOT EXISTS public.camera_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id text NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  person_threshold double precision NOT NULL DEFAULT 0.5,
  vehicle_threshold double precision NOT NULL DEFAULT 0.5,
  counting_lines jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (camera_id)
);

ALTER TABLE public.camera_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_select_auth'
  ) THEN
    CREATE POLICY "ccfg_select_auth"
      ON public.camera_configs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_write_admin_operator'
  ) THEN
    CREATE POLICY "ccfg_write_admin_operator"
      ON public.camera_configs
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_update_admin_operator'
  ) THEN
    CREATE POLICY "ccfg_update_admin_operator"
      ON public.camera_configs
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_delete_admin'
  ) THEN
    CREATE POLICY "ccfg_delete_admin"
      ON public.camera_configs
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  -- service role can write
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_write_service'
  ) THEN
    CREATE POLICY "ccfg_write_service"
      ON public.camera_configs
      FOR INSERT
      TO public
      WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'camera_configs' AND policyname = 'ccfg_update_service'
  ) THEN
    CREATE POLICY "ccfg_update_service"
      ON public.camera_configs
      FOR UPDATE
      TO public
      USING ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'))
      WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));
  END IF;
END$$;

-- Trigger for camera_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_camera_configs_updated_at'
  ) THEN
    CREATE TRIGGER trg_camera_configs_updated_at
      BEFORE UPDATE ON public.camera_configs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 5) Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL UNIQUE,
  label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'veh_master_select_auth'
  ) THEN
    CREATE POLICY "veh_master_select_auth"
      ON public.vehicles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'veh_master_insert_admin_service'
  ) THEN
    CREATE POLICY "veh_master_insert_admin_service"
      ON public.vehicles
      FOR INSERT
      TO public
      WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'veh_master_update_admin_operator_service'
  ) THEN
    CREATE POLICY "veh_master_update_admin_operator_service"
      ON public.vehicles
      FOR UPDATE
      TO public
      USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'operator') OR 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'operator') OR 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'veh_master_delete_admin'
  ) THEN
    CREATE POLICY "veh_master_delete_admin"
      ON public.vehicles
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- Trigger for vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vehicles_updated_at'
  ) THEN
    CREATE TRIGGER trg_vehicles_updated_at
      BEFORE UPDATE ON public.vehicles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 6) Storage buckets for media (people & vehicles)
INSERT INTO storage.buckets (id, name, public)
VALUES ('people', 'people', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_read_auth'
  ) THEN
    CREATE POLICY "media_read_auth"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id IN ('people','vehicles'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_insert_admin_operator'
  ) THEN
    CREATE POLICY "media_insert_admin_operator"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id IN ('people','vehicles') AND 
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_update_admin_operator'
  ) THEN
    CREATE POLICY "media_update_admin_operator"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id IN ('people','vehicles') AND 
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
      )
      WITH CHECK (
        bucket_id IN ('people','vehicles') AND 
        (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
      );
  END IF;

  -- service role write access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_insert_service'
  ) THEN
    CREATE POLICY "media_insert_service"
      ON storage.objects
      FOR INSERT
      TO public
      WITH CHECK (
        bucket_id IN ('people','vehicles') AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_update_service'
  ) THEN
    CREATE POLICY "media_update_service"
      ON storage.objects
      FOR UPDATE
      TO public
      USING (
        bucket_id IN ('people','vehicles') AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      )
      WITH CHECK (
        bucket_id IN ('people','vehicles') AND 
        (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media_delete_admin'
  ) THEN
    CREATE POLICY "media_delete_admin"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id IN ('people','vehicles') AND public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;
