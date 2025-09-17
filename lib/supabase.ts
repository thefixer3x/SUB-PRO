import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

const missingEnv = !supabaseUrl || !supabaseAnonKey;
if (missingEnv) {
  // Avoid crashing app on web when env is missing (e.g., misconfigured Vercel preview)
  // We’ll still log a clear error and use a safe stub client so the landing page can render.
  // Correct fix is to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the host env.
  // eslint-disable-next-line no-console
  console.error('Missing Supabase EXPO_PUBLIC_* env. Running in limited (no-auth) mode.');
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
export const supabase = !missingEnv
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: createStorageAdapter(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : ({
      auth: {
        async getSession() {
          return { data: { session: null }, error: { message: 'Missing Supabase env' } as any };
        },
        async signInWithPassword() {
          return { data: { session: null }, error: { message: 'Missing Supabase env' } as any };
        },
        async signUp() {
          return { data: { user: null, session: null }, error: { message: 'Missing Supabase env' } as any };
        },
        async signOut() {
          return { error: { message: 'Missing Supabase env' } as any };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } } as any;
        },
      },
      from() {
        const err = { error: { message: 'Missing Supabase env' } };
        return {
          insert: async () => err,
          upsert: async () => err,
          update: async () => err,
          select: () => ({ single: async () => ({ data: null, error: err.error }) }),
          eq: () => ({ select: () => ({ single: async () => ({ data: null, error: err.error }) }) }),
        } as any;
      },
      rpc: async () => ({ data: null, error: { message: 'Missing Supabase env' } }),
    } as any);

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
