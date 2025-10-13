import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if we have the required environment variables
const missingEnv = !supabaseUrl || !supabaseAnonKey;
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
const isUrlValid = supabaseUrl ? isValidUrl(supabaseUrl) : false;

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
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
