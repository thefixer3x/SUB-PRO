/*
# Feature Flags Table

1. New Tables
  - `feature_flags`
    - `id` (serial, primary key)
    - `name` (text, unique)
    - `enabled` (boolean)
    - `description` (text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

2. Security
  - Enable RLS on `feature_flags` table
  - Add policy for read access to everyone
*/

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default feature flags
INSERT INTO public.feature_flags (name, enabled, description) VALUES
  ('DARK_MODE', true, 'Enable dark mode in the app'),
  ('COMMUNITY_STATS', true, 'Enable community statistics'),
  ('SMART_INSIGHTS', false, 'Enable smart insights feature'),
  ('BULK_UPLOAD', false, 'Enable bulk upload feature'),
  ('EMBED_FINANCE_BETA', false, 'Enable embedded finance beta features'),
  ('MONETIZATION_V1', true, 'Enable monetization features'),
  ('SOCIAL_V1', true, 'Enable social features'),
  ('COMPLIANCE_CENTER', true, 'Enable compliance center'),
  ('SECURITY_MONITORING', true, 'Enable security monitoring'),
  ('GDPR_TOOLS', true, 'Enable GDPR tools'),
  ('AUDIT_LOGGING', true, 'Enable audit logging'),
  ('PARTNER_HUB', true, 'Enable partner hub');

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Create policy for read access
CREATE POLICY "Allow read access to everyone" ON public.feature_flags
  FOR SELECT
  USING (true);

-- Add function to update feature flags
CREATE OR REPLACE FUNCTION public.update_feature_flag(flag_name TEXT, flag_enabled BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.feature_flags
  SET enabled = flag_enabled, updated_at = now()
  WHERE name = flag_name;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy for update function
CREATE POLICY "Allow updates through function" ON public.feature_flags
  FOR UPDATE
  USING (true);