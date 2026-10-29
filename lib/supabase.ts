import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration.
//
// EXPO_PUBLIC_* values are inlined into the client bundle at build time, so only values that are
// safe to publish may be referenced in this file. A publishable key (`sb_publishable_...`) is public
// by design and carries the same privileges as the legacy `anon` key. A secret key (`sb_secret_...`),
// a service_role key, or any Stripe secret must NEVER be referenced here: everything in this file
// ships to every browser and every app bundle. Server-only secrets belong in function env vars.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const envAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Scrub artefact from the history rewrite. It must never be treated as a usable key — sending it
// produces an opaque 401 from Supabase ("Invalid API key") that looks like a wrong key.
const REDACTED_KEY = '***REMOVED-SUPABASE-CREDENTIAL***';

/**
 * Accepts both supported public-key formats:
 *   - `sb_publishable_...` (current format; NOT a JWT)
 *   - a legacy `anon` JWT (three dot-separated segments)
 *
 * Length is deliberately not the discriminator. The previous `envAnonKey.length > 150` test was
 * true for legacy JWTs (208 chars) but false for publishable keys (~40-50 chars), so a valid new
 * key was silently replaced by a placeholder and every request failed with a 401.
 */
export const isUsablePublicKey = (value: string): boolean =>
  value.length > 0 &&
  value !== REDACTED_KEY &&
  (value.startsWith('sb_publishable_') || value.split('.').length === 3);

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
const isUrlValid = supabaseUrl ? isValidUrl(supabaseUrl) : false;

export const isSupabaseEnvConfigured = Boolean(supabaseUrl) && isUrlValid && isUsablePublicKey(envAnonKey);

// No credential-shaped fallbacks. `unconfigured.invalid` is a reserved TLD (RFC 2606) that never
// resolves, so a misconfigured build fails fast and locally instead of shipping a plausible-looking
// URL/key pair into the bundle. Call sites already gate on `isSupabaseEnvConfigured`.
const UNCONFIGURED_URL = 'https://unconfigured.invalid';
const UNCONFIGURED_KEY = 'unconfigured';

const effectiveSupabaseUrl = isSupabaseEnvConfigured ? supabaseUrl : UNCONFIGURED_URL;
const effectiveSupabaseAnonKey = isSupabaseEnvConfigured ? envAnonKey : UNCONFIGURED_KEY;

if (!isSupabaseEnvConfigured) {
  console.warn(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
      '(EXPO_PUBLIC_SUPABASE_ANON_KEY is also accepted for a legacy anon key). ' +
      'Features that depend on Supabase are disabled until then.',
  );
}

// Platform-specific storage adapter
const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        if (typeof localStorage === 'undefined') {
          return null;
        }
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof localStorage === 'undefined') {
          return;
        }
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof localStorage === 'undefined') {
          return;
        }
        localStorage.removeItem(key);
      },
    };
  } else {
    return AsyncStorage;
  }
};

// Create Supabase client with proper storage
export const supabase = createClient<Database, 'public'>(effectiveSupabaseUrl, effectiveSupabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Database types (to be generated with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          subscription_tier: 'free' | 'pro' | 'team';
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          subscription_tier?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          subscription_tier?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          detection_key: string | null;
          name: string;
          category: string;
          status: 'Active' | 'Inactive' | 'Paused' | 'Trial' | 'Expired';
          plan_name: string;
          monthly_cost: number;
          currency: string;
          billing_cycle: 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly';
          renewal_date: string;
          payment_method: string;
          notes: string | null;
          last_used: string | null;
          priority: 'High' | 'Medium' | 'Low';
          deactivation_date: string | null;
          logo_url: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          detection_key?: string | null;
          name: string;
          category: string;
          status?: 'Active' | 'Inactive' | 'Paused' | 'Trial' | 'Expired';
          plan_name: string;
          monthly_cost: number;
          currency?: string;
          billing_cycle: 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly';
          renewal_date: string;
          payment_method: string;
          notes?: string | null;
          last_used?: string | null;
          priority?: 'High' | 'Medium' | 'Low';
          deactivation_date?: string | null;
          logo_url?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          detection_key?: string | null;
          name?: string;
          category?: string;
          status?: 'Active' | 'Inactive' | 'Paused' | 'Trial' | 'Expired';
          plan_name?: string;
          monthly_cost?: number;
          currency?: string;
          billing_cycle?: 'Monthly' | 'Quarterly' | 'Annually' | 'Weekly';
          renewal_date?: string;
          payment_method?: string;
          notes?: string | null;
          last_used?: string | null;
          priority?: 'High' | 'Medium' | 'Low';
          deactivation_date?: string | null;
          logo_url?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          bank_name: string;
          account_type: string;
          account_number: string | null;
          balance: number;
          currency: string;
          is_connected: boolean;
          last_sync: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          bank_name: string;
          account_type: string;
          account_number?: string | null;
          balance?: number;
          currency?: string;
          is_connected?: boolean;
          last_sync?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bank_name?: string;
          account_type?: string;
          account_number?: string | null;
          balance?: number;
          currency?: string;
          is_connected?: boolean;
          last_sync?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sm_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          status: string;
          plan_name: string;
          monthly_cost: number;
          currency: string;
          billing_cycle: string;
          renewal_date: string;
          payment_method: string;
          notes: string | null;
          last_used: string | null;
          priority: string;
          deactivation_date: string | null;
          logo_url: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          status?: string;
          plan_name: string;
          monthly_cost: number;
          currency?: string;
          billing_cycle?: string;
          renewal_date: string;
          payment_method: string;
          notes?: string | null;
          last_used?: string | null;
          priority?: string;
          deactivation_date?: string | null;
          logo_url?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: string;
          status?: string;
          plan_name?: string;
          monthly_cost?: number;
          currency?: string;
          billing_cycle?: string;
          renewal_date?: string;
          payment_method?: string;
          notes?: string | null;
          last_used?: string | null;
          priority?: string;
          deactivation_date?: string | null;
          logo_url?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sm_feature_flags: {
        Row: {
          id: string;
          name: string;
          enabled: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          enabled?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          enabled?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      virtual_cards: {
        Row: {
          id: string;
          user_id: string;
          stripe_card_id: string;
          last4: string;
          brand: string;
          status: string;
          subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_card_id: string;
          last4: string;
          brand: string;
          status: string;
          subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_card_id?: string;
          last4?: string;
          brand?: string;
          status?: string;
          subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      card_authorizations: {
        Row: {
          id: string;
          stripe_authorization_id: string;
          stripe_card_id: string;
          amount: number;
          currency: string;
          merchant_name: string;
          merchant_category: string;
          approved: boolean;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          stripe_authorization_id: string;
          stripe_card_id: string;
          amount: number;
          currency: string;
          merchant_name: string;
          merchant_category: string;
          approved: boolean;
          transaction_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          stripe_authorization_id?: string;
          stripe_card_id?: string;
          amount?: number;
          currency?: string;
          merchant_name?: string;
          merchant_category?: string;
          approved?: boolean;
          transaction_date?: string;
          created_at?: string;
        };
      };
      payment_records: {
        Row: {
          id: string;
          user_id: string;
          stripe_payment_intent_id: string | null;
          stripe_invoice_id: string | null;
          amount: number;
          currency: string;
          status: 'succeeded' | 'failed' | 'pending';
          subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_payment_intent_id?: string | null;
          stripe_invoice_id?: string | null;
          amount: number;
          currency: string;
          status: 'succeeded' | 'failed' | 'pending';
          subscription_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_payment_intent_id?: string | null;
          stripe_invoice_id?: string | null;
          amount?: number;
          currency?: string;
          status?: 'succeeded' | 'failed' | 'pending';
          subscription_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
