/**
 * Shared authentication helper for Vercel functions.
 *
 * Ported from netlify/functions/_shared/auth.ts — same 401/503 rules,
 * same allowlist, same session-only user resolution.
 *
 * Usage:
 *   const auth = await requireUser(request);
 *   if (!auth.ok) return auth.response;   // 401 / 503
 *   const userId = auth.user.id;           // from the session
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonResponse, getRequestOrigin, corsHeaders, type JsonResponse } from './cors';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  metadata: Record<string, unknown>;
}

export type AuthOutcome =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: JsonResponse };

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
  process.env.SUPABASE_ANON_KEY ||
  '';

const getServiceRoleKey = (): string =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Pull the access token out of an `Authorization: Bearer *** header. */
export const extractBearerToken = (
  headers: Record<string, string | undefined>,
): string | null => {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw || !/^Bearer\s+/i.test(raw)) return null;
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 ? token : null;
};

/**
 * Verify the caller.
 *
 * Returns the authenticated user on success. On failure it returns the
 * response to send back: 401 when the token is missing or invalid, 503 when
 * the function is not configured with Supabase credentials.
 */
export const requireUser = async (request: Request): Promise<AuthOutcome> => {
  const headers = Object.fromEntries(request.headers.entries());
  const origin = getRequestOrigin(headers);
  const accessToken = extractBearerToken(headers);

  if (!accessToken) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Authentication required' }, origin),
    };
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[server/auth] Supabase auth env missing');
    return {
      ok: false,
      response: jsonResponse(503, { error: 'Authentication service not configured' }, origin),
    };
  }

  let authResult: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    authResult = await supabase.auth.getUser(accessToken);
  } catch (authFailure) {
    console.error('[server/auth] Supabase getUser threw:', authFailure);
    return {
      ok: false,
      response: jsonResponse(503, { error: 'Authentication service temporarily unavailable' }, origin),
    };
  }

  const { data, error } = authResult;
  if (error || !data?.user) {
    const authError = error as { status?: number; code?: string } | null;
    const isInvalidToken =
      authError?.status === 401 ||
      authError?.status === 403 ||
      (typeof authError?.code === 'string' &&
        /invalid|expired|unauthorized|deleted_user/i.test(authError.code));

    if (isInvalidToken) {
      console.warn('[server/auth] Invalid user token');
      return {
        ok: false,
        response: jsonResponse(401, { error: 'Invalid or expired session' }, origin),
      };
    }

    console.error('[server/auth] Supabase getUser failed:', error?.message ?? error);
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
 * Server-side Supabase client (service role key).
 *
 * It bypasses row level security, so every query built on top of it has to
 * filter on the user id taken from the verified session.
 */
export const getServiceRoleClient = (): SupabaseClient | null => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[server/auth] Supabase service role env missing');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
