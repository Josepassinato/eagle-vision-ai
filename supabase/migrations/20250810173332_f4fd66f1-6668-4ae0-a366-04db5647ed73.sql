-- EduBehavior core tables
-- 1) edu_classes
CREATE TABLE IF NOT EXISTS public.edu_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.edu_classes ENABLE ROW LEVEL SECURITY;

-- Policies for edu_classes
CREATE POLICY "edu_classes_select_auth"
ON public.edu_classes
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_classes_insert_admin"
ON public.edu_classes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "edu_classes_update_admin"
ON public.edu_classes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "edu_classes_delete_admin"
ON public.edu_classes
FOR DELETE
USING (has_role(auth.uid(), 'admin'));


-- 2) edu_roster
CREATE TABLE IF NOT EXISTS public.edu_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.edu_classes(id) ON DELETE CASCADE,
  student_code TEXT NOT NULL,
  metadata JSONB
);

ALTER TABLE public.edu_roster ENABLE ROW LEVEL SECURITY;

-- Policies for edu_roster
CREATE POLICY "edu_roster_select_auth"
ON public.edu_roster
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_roster_insert_admin_operator"
ON public.edu_roster
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "edu_roster_update_admin_operator"
ON public.edu_roster
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "edu_roster_delete_admin"
ON public.edu_roster
FOR DELETE
USING (has_role(auth.uid(), 'admin'));


-- 3) edu_policies
CREATE TABLE IF NOT EXISTS public.edu_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.edu_classes(id) ON DELETE CASCADE,
  thresholds JSONB NOT NULL,
  notify_min_severity TEXT DEFAULT 'HIGH'
);

ALTER TABLE public.edu_policies ENABLE ROW LEVEL SECURITY;

-- Policies for edu_policies
CREATE POLICY "edu_policies_select_auth"
ON public.edu_policies
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_policies_insert_admin_operator_service"
ON public.edu_policies
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));

CREATE POLICY "edu_policies_update_admin_operator_service"
ON public.edu_policies
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));

CREATE POLICY "edu_policies_delete_admin"
ON public.edu_policies
FOR DELETE
USING (has_role(auth.uid(), 'admin'));


-- 4) edu_signals
CREATE TABLE IF NOT EXISTS public.edu_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.edu_classes(id),
  student_id UUID REFERENCES public.edu_roster(id),
  camera_id TEXT,
  ts TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  details JSONB,
  frame_url TEXT
);

ALTER TABLE public.edu_signals ENABLE ROW LEVEL SECURITY;

-- Policies for edu_signals
CREATE POLICY "edu_signals_select_auth"
ON public.edu_signals
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_signals_insert_service"
ON public.edu_signals
FOR INSERT
WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));

-- Indexes for edu_signals
CREATE INDEX IF NOT EXISTS idx_edu_signals_type_ts ON public.edu_signals (type, ts);
CREATE INDEX IF NOT EXISTS idx_edu_signals_class_ts ON public.edu_signals (class_id, ts);

-- Affect columns (real-time affect extension)
ALTER TABLE public.edu_signals
  ADD COLUMN IF NOT EXISTS affect_probs JSONB,
  ADD COLUMN IF NOT EXISTS affect_state TEXT;

CREATE INDEX IF NOT EXISTS idx_edu_signals_affect_ts
  ON public.edu_signals (type, ts);


-- 5) edu_incidents
CREATE TABLE IF NOT EXISTS public.edu_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.edu_classes(id),
  first_ts TIMESTAMPTZ DEFAULT now(),
  last_ts TIMESTAMPTZ DEFAULT now(),
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  student_id UUID REFERENCES public.edu_roster(id),
  aggregation_key TEXT,
  signals_count INT DEFAULT 1,
  clip_url TEXT,
  notes TEXT
);

ALTER TABLE public.edu_incidents ENABLE ROW LEVEL SECURITY;

-- Policies for edu_incidents
CREATE POLICY "edu_incidents_select_auth"
ON public.edu_incidents
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_incidents_insert_service"
ON public.edu_incidents
FOR INSERT
WITH CHECK ((((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));

CREATE POLICY "edu_incidents_update_admin_operator_service"
ON public.edu_incidents
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator') OR (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role'));

-- Helpful indexes for incidents
CREATE INDEX IF NOT EXISTS idx_edu_incidents_class_ts ON public.edu_incidents (class_id, last_ts);
CREATE INDEX IF NOT EXISTS idx_edu_incidents_status ON public.edu_incidents (status);
CREATE INDEX IF NOT EXISTS idx_edu_incidents_severity ON public.edu_incidents (severity);


-- 6) edu_reviews (audit trail of human-in-the-loop)
CREATE TABLE IF NOT EXISTS public.edu_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.edu_incidents(id) ON DELETE CASCADE,
  reviewer_user_id UUID,
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  decision TEXT NOT NULL,
  notes TEXT
);

ALTER TABLE public.edu_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for edu_reviews
CREATE POLICY "edu_reviews_select_auth"
ON public.edu_reviews
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "edu_reviews_insert_admin_operator_self"
ON public.edu_reviews
FOR INSERT
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) AND reviewer_user_id = auth.uid());

CREATE POLICY "edu_reviews_update_admin_operator_self"
ON public.edu_reviews
FOR UPDATE
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) AND reviewer_user_id = auth.uid())
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator')) AND reviewer_user_id = auth.uid());
