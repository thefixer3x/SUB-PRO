-- Migration: Fix Feature Flags Table and Function Names
-- Date: 2025-07-01

/*
# Fix Feature Flags Schema

1. New Tables
   - Creates sm_feature_flags table if it doesn't exist
   - Preserves existing feature_flags data if present

2. Security
   - Enables RLS on sm_feature_flags table
   - Creates appropriate policies for public read access and service role updates

3. Functions
   - Adds sm_update_feature_flag function for safe updates
*/

-- Create feature flags table with sm_ prefix if it doesn't exist
CREATE TABLE IF NOT EXISTS sm_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS if not already enabled
ALTER TABLE sm_feature_flags ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sm_feature_flags' AND policyname = 'Allow read access to everyone'
    ) THEN
        CREATE POLICY "Allow read access to everyone" ON sm_feature_flags
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sm_feature_flags' AND policyname = 'Service role can update'
    ) THEN
        CREATE POLICY "Service role can update" ON sm_feature_flags
            FOR ALL USING (auth.jwt()->>'role' = 'service_role');
    END IF;
END $$;

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

-- Create updated_at trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_sm_feature_flags_updated_at'
    ) THEN
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
    END IF;
END $$;

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

-- Migrate data from feature_flags if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'feature_flags'
    ) THEN
        INSERT INTO sm_feature_flags (name, enabled, description, created_at, updated_at)
        SELECT name, enabled, description, created_at, updated_at
        FROM feature_flags
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;