-- Migration: Create sm_feature_flags table for Subscription Manager
-- Date: 2025-06-30

-- Drop existing table if it exists (be careful in production!)
DROP TABLE IF EXISTS feature_flags CASCADE;

-- Create feature flags table with sm_ prefix
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
CREATE POLICY "Allow public read access" ON sm_feature_flags
  FOR SELECT USING (true);

-- Only service role can update
CREATE POLICY "Service role can update" ON sm_feature_flags
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

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
  ('MONETIZATION_V1', false, 'Version 1 monetization features'),
  ('SOCIAL_V1', false, 'Version 1 social features'),
  ('COMPLIANCE_CENTER', false, 'Compliance center features'),
  ('SECURITY_MONITORING', false, 'Security monitoring dashboard'),
  ('GDPR_TOOLS', false, 'GDPR compliance tools'),
  ('AUDIT_LOGGING', false, 'Audit logging features'),
  ('PARTNER_HUB', false, 'Partner hub features')
ON CONFLICT (name) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sm_feature_flags_updated_at
  BEFORE UPDATE ON sm_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
