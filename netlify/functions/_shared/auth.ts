/**
 * Shared authentication helper for the Netlify functions.
 *
 * The bearer token check lives here (it used to be inline in
 * `banking-proxy.ts`) so every function that touches user data can require a
 * verified Supabase session the same way.
 *
 * The user id is taken from the verified session only. Client supplied ids are
 * never trusted.
 *
 * Usage:
 *   const auth = await requireUser(event);
 *   if (!auth.ok) return auth.response;   // 401 / 503
 *   const userId = auth.user.id;          // from the session
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRequestOrigin, jsonResponse, type NetlifyEvent, type NetlifyResult } from './cors';

export type { NetlifyEvent, NetlifyResult };

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  metadata: Record<string, unknown>;
}

export type AuthOutcome =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NetlifyResult };

const getSupabaseUrl = (): string =>
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const getSupabaseAnonKey = (): string =>
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const getServiceRoleKey = (): string =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Pull the access token out of an `Authorization: Bearer <token>` header. */
export const extractBearerToken = (
  headers: Record<string, string | undefined> | undefined,
): string | null => {
  const raw = headers?.authorization ?? headers?.Authorization;

  if (!raw || !raw.startsWith('Bearer ')) {
    return null;
  }

  const token = raw.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * Verify the caller.
 *
 * Returns the authenticated user on success. On failure it returns the
 * response to send back: 401 when the token is missing or invalid, 503 when
 * the function is not configured with Supabase credentials.
 */
export const requireUser = async (event: NetlifyEvent): Promise<AuthOutcome> => {
  const origin = getRequestOrigin(event);
  const accessToken = extractBearerToken(event.headers);

  if (!accessToken) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Authentication required' }, origin),
    };
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[netlify/_shared/auth] Supabase auth env missing');
    return {
      ok: false,
      response: jsonResponse(503, { error: 'Authentication service not configured' }, origin),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    // Distinguish token errors (401) from infrastructure failures (503).
    // Supabase returns message fields like "Invalid JWT" or "Token expired" for auth failures;
    // network/timeout errors indicate the Supabase service is unreachable.
    const isTokenError =
      error &&
      typeof error.message === 'string' &&
      /invalid|expired|unauthorized|malformed/i.test(error.message);

    if (isTokenError) {
      console.warn('[netlify/_shared/auth] Invalid user token');
      return {
        ok: false,
        response: jsonResponse(401, { error: 'Invalid or expired session' }, origin),
      };
    }

    console.error('[netlify/_shared/auth] Supabase getUser failed:', error?.message ?? error);
    return {
      ok: false,
      response: jsonResponse(503, { error: 'Authentication service temporarily unavailable' }, origin),
    };
  }

  const user = data.user;

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    },
  };
};

/**
 * Server side Supabase client (service role key).
 *
 * It bypasses row level security, so every query built on top of it has to
 * filter on the user id taken from the verified session.
 */
export const getServiceRoleClient = (): SupabaseClient | null => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[netlify/_shared/auth] Supabase service role env missing');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
