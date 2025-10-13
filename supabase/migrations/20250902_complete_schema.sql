-- Complete Supabase Schema Migration for SubTrack Pro
-- Date: 2025-09-02
-- This migration creates all necessary tables, functions, and policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- This extends Supabase auth.users with application-specific data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'pro', 'team')) DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role has full access to profiles" ON profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 2. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT CHECK (status IN ('Active', 'Inactive', 'Paused', 'Trial', 'Expired')) DEFAULT 'Active',
  plan_name TEXT NOT NULL,
  monthly_cost DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT CHECK (billing_cycle IN ('Monthly', 'Quarterly', 'Annually', 'Weekly')) DEFAULT 'Monthly',
  renewal_date TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  last_used TIMESTAMPTZ,
  priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
  deactivation_date TIMESTAMPTZ,
  logo_url TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can manage own subscriptions" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 3. VIRTUAL CARDS TABLE (for embedded finance features)
CREATE TABLE IF NOT EXISTS virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_card_id TEXT NOT NULL UNIQUE,
  last4 TEXT NOT NULL,
  brand TEXT NOT NULL,
  status TEXT NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on virtual_cards
ALTER TABLE virtual_cards ENABLE ROW LEVEL SECURITY;

-- Virtual cards policies
CREATE POLICY "Users can manage own virtual cards" ON virtual_cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to virtual cards" ON virtual_cards
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 4. CARD AUTHORIZATIONS TABLE (for spending tracking)
CREATE TABLE IF NOT EXISTS card_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_authorization_id TEXT NOT NULL UNIQUE,
  stripe_card_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'USD',
  merchant_name TEXT NOT NULL,
  merchant_category TEXT DEFAULT 'general',
  approved BOOLEAN NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on card_authorizations
ALTER TABLE card_authorizations ENABLE ROW LEVEL SECURITY;

-- Card authorizations policies (via virtual cards relationship)
CREATE POLICY "Users can view own card authorizations" ON card_authorizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM virtual_cards 
      WHERE virtual_cards.stripe_card_id = card_authorizations.stripe_card_id 
      AND virtual_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to card authorizations" ON card_authorizations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 5. PAYMENT RECORDS TABLE (for payment tracking)
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK (status IN ('succeeded', 'failed', 'pending')) NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on payment_records
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Payment records policies
CREATE POLICY "Users can view own payment records" ON payment_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to payment records" ON payment_records
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 6. SM_FEATURE_FLAGS TABLE (already created but ensuring it exists)
CREATE TABLE IF NOT EXISTS sm_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on sm_feature_flags
ALTER TABLE sm_feature_flags ENABLE ROW LEVEL SECURITY;

-- Feature flags policies
CREATE POLICY "Allow public read access to feature flags" ON sm_feature_flags
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage feature flags" ON sm_feature_flags
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- FUNCTIONS

-- Function to create virtual cards table if not exists (referenced in database.ts)
CREATE OR REPLACE FUNCTION create_virtual_cards_table_if_not_exists()
RETURNS BOOLEAN AS $$
BEGIN
  -- Table should already exist, so just return true
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update feature flags (already exists but ensuring consistency)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGERS for updated_at columns

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables that need them
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_virtual_cards_updated_at ON virtual_cards;
CREATE TRIGGER update_virtual_cards_updated_at
  BEFORE UPDATE ON virtual_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sm_feature_flags_updated_at ON sm_feature_flags;
CREATE TRIGGER update_sm_feature_flags_updated_at
  BEFORE UPDATE ON sm_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PROFILE CREATION TRIGGER
-- Automatically create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- INSERT DEFAULT FEATURE FLAGS (if not already present)
INSERT INTO sm_feature_flags (name, enabled, description) VALUES
  ('DARK_MODE', true, 'Enable dark mode theme'),
  ('COMMUNITY_STATS', true, 'Show community statistics'),
  ('SMART_INSIGHTS', true, 'Enable smart insights features'),
  ('BULK_UPLOAD', true, 'Allow bulk upload functionality'),
  ('EMBED_FINANCE_BETA', true, 'Beta finance embedding features'),
  ('MONETIZATION_V1', true, 'Version 1 monetization features'),
  ('SOCIAL_V1', true, 'Version 1 social features'),
  ('COMPLIANCE_CENTER', true, 'Compliance center features'),
  ('SECURITY_MONITORING', true, 'Security monitoring dashboard'),
  ('GDPR_TOOLS', true, 'GDPR compliance tools'),
  ('AUDIT_LOGGING', true, 'Audit logging features'),
  ('PARTNER_HUB', true, 'Partner hub features')
ON CONFLICT (name) DO NOTHING;