-- Repair auth signup bootstrapping for the live SUB-PRO schema.
-- The observed production project provisions three public records for each
-- auth user: organizations, users, and profiles. This migration makes that
-- flow idempotent and safe to rerun.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'managed_by_supabase_auth',
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS is_vendor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_tier_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'pro', 'team'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  email_local_part TEXT;
  generated_name TEXT;
  generated_slug TEXT;
BEGIN
  email_local_part := split_part(COALESCE(NEW.email, ''), '@', 1);
  generated_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(email_local_part, ''),
    'SubTrack Pro User'
  );

  generated_slug := lower(regexp_replace(generated_name, '[^a-zA-Z0-9]+', '-', 'g'));
  generated_slug := trim(both '-' from generated_slug);
  generated_slug := left(COALESCE(NULLIF(generated_slug, ''), 'subtrack-pro-user'), 40)
    || '-' || left(replace(NEW.id::text, '-', ''), 8);

  INSERT INTO public.organizations (
    id,
    name,
    slug,
    description,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    generated_name,
    generated_slug,
    'Auto-created during user signup',
    true,
    timezone('utc', now()),
    timezone('utc', now())
  )
  RETURNING id INTO org_id;

  INSERT INTO public.users (
    id,
    email,
    password_hash,
    organization_id,
    role,
    plan,
    settings,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    'managed_by_supabase_auth',
    org_id,
    'user',
    'free',
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        organization_id = COALESCE(public.users.organization_id, EXCLUDED.organization_id),
        updated_at = timezone('utc', now());

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    company_name,
    business_type,
    is_vendor,
    subscription_tier,
    stripe_customer_id,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'business_type', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_vendor')::boolean, false),
    'free',
    NULL,
    org_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name),
        business_type = COALESCE(EXCLUDED.business_type, public.profiles.business_type),
        organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
        updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, SELECT, UPDATE ON public.organizations TO supabase_auth_admin;
GRANT INSERT, SELECT, UPDATE ON public.users TO supabase_auth_admin;
GRANT INSERT, SELECT, UPDATE ON public.profiles TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
