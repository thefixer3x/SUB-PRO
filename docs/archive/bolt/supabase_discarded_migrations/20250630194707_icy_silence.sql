-- Create feature flags table with sm_ prefix
-- Migration to fix feature flags integration
-- This ensures we use the correct table name and function prefix

-- Create feature flags table with sm_ prefix (if not exists)
CREATE TABLE IF NOT EXISTS sm_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE sm_feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'sm_feature_flags' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON sm_feature_flags
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Only service role can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'sm_feature_flags' AND policyname = 'Service role can update'
  ) THEN
    CREATE POLICY "Service role can update" ON sm_feature_flags
      FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END
$$;

-- Create update function for feature flags
CREATE OR REPLACE FUNCTION sm_update_feature_flag(
  flag_name VARCHAR,
  flag_enabled BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO sm_feature_flags (name, enabled)
  VALUES (flag_name, flag_enabled)
  ON CONFLICT (name)
  DO UPDATE SET 
    enabled = EXCLUDED.enabled,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert default feature flags
INSERT INTO sm_feature_flags (name, enabled, description) VALUES
  ('DARK_MODE', true, 'Enable dark mode theme'),
  ('COMMUNITY_STATS', true, 'Show community statistics'),
  ('SMART_INSIGHTS', true, 'Enable smart insights features'),
  ('BULK_UPLOAD', true, 'Allow bulk upload functionality'),
  ('EMBED_FINANCE_BETA', false, 'Beta finance embedding features'),
  ('MONETIZATION_V1', true, 'Version 1 monetization features'),
  ('SOCIAL_V1', true, 'Version 1 social features'),
  ('COMPLIANCE_CENTER', true, 'Compliance center features'),
  ('SECURITY_MONITORING', true, 'Security monitoring dashboard'),
  ('GDPR_TOOLS', true, 'GDPR compliance tools'),
  ('AUDIT_LOGGING', true, 'Audit logging features'),
  ('PARTNER_HUB', true, 'Partner hub features')
ON CONFLICT (name) DO 
UPDATE SET description = EXCLUDED.description;

-- Create updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_sm_feature_flags_updated_at'
  ) THEN
    CREATE TRIGGER update_sm_feature_flags_updated_at
      BEFORE UPDATE ON sm_feature_flags
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;