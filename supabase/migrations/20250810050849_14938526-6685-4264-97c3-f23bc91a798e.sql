-- Create credits ledger and payment sessions tables with RLS and policies
-- Ledger of credit changes per user
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL, -- positive for purchases, negative for consumption
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for credit_ledger
DO $$ BEGIN
  -- Users can view their own ledger
  CREATE POLICY ledger_select_own ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Service role can insert adjustments (purchases/consumption via backend services)
  CREATE POLICY ledger_insert_service ON public.credit_ledger
  FOR INSERT
  TO public
  WITH CHECK (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Admins can insert manual adjustments
  CREATE POLICY ledger_insert_admin ON public.credit_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Admins can delete erroneous entries
  CREATE POLICY ledger_delete_admin ON public.credit_ledger
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sessions tracking to ensure idempotent crediting
CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  credits integer NOT NULL,
  amount integer NOT NULL, -- cents
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for payment_sessions
DO $$ BEGIN
  -- Users can view their own sessions
  CREATE POLICY pay_sess_select_own ON public.payment_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Service role writes sessions
  CREATE POLICY pay_sess_insert_service ON public.payment_sessions
  FOR INSERT
  TO public
  WITH CHECK (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY pay_sess_update_service ON public.payment_sessions
  FOR UPDATE
  TO public
  USING (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role')
  WITH CHECK (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger to keep updated_at current
DO $$ BEGIN
  CREATE TRIGGER update_payment_sessions_updated_at
  BEFORE UPDATE ON public.payment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;