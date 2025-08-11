-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  industry TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trial credits table
CREATE TABLE public.trial_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_granted INTEGER NOT NULL DEFAULT 100,
  credits_used INTEGER NOT NULL DEFAULT 0,
  trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.trial_credits ENABLE ROW LEVEL SECURITY;

-- Policies for trial credits
CREATE POLICY "Users can view their own trial credits" ON public.trial_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Function to create profile and trial credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, company_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa')
  );
  
  -- Grant trial credits
  INSERT INTO public.trial_credits (user_id, credits_granted, trial_start, trial_end)
  VALUES (
    NEW.id,
    100,
    now(),
    now() + INTERVAL '7 days'
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile and trial credits
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create onboarding_steps table
CREATE TABLE public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_name)
);

-- Enable RLS
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Policies for onboarding steps
CREATE POLICY "Users can view their own onboarding steps" ON public.onboarding_steps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding steps" ON public.onboarding_steps
  FOR ALL USING (auth.uid() = user_id);

-- Function to get user's remaining trial credits
CREATE OR REPLACE FUNCTION public.get_user_trial_credits(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(credits_remaining INTEGER, trial_days_left INTEGER, trial_active BOOLEAN)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    GREATEST(0, tc.credits_granted - tc.credits_used) as credits_remaining,
    GREATEST(0, EXTRACT(days FROM tc.trial_end - now())::INTEGER) as trial_days_left,
    (tc.trial_end > now() AND tc.credits_granted > tc.credits_used) as trial_active
  FROM public.trial_credits tc
  WHERE tc.user_id = p_user_id;
$$;