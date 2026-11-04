/**
 * Supabase admin client for Vercel functions.
 *
 * Uses the service-role key to bypass RLS.  Every table operation built on
 * top of this client must still filter on the user id taken from the
 * verified session (requireUser in server/auth.ts).
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a service-role Supabase client, or null when env vars are missing.
 *
 * Unlike the anonymous client (server/auth.ts), this key bypasses all
 * row-level security policies — use with caution.
 */
export const createSupabaseAdmin = (): SupabaseClient | null => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.SUPABASE_URL
    || '';
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[server/supabase-admin] Supabase service role env missing');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
