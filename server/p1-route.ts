/** Shared auth + response helpers for the P1 Expo Router API routes. */

import { requireUser } from './auth';
import { createSupabaseAdmin } from './supabase-admin';
import { fromAuthResponse, jsonFrom } from './api-response';
import type { SupabaseClient } from '@supabase/supabase-js';

export type P1RouteAuth =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: Response };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function authenticateP1Route(request: Request): Promise<P1RouteAuth> {
  const auth = await requireUser(request);
  if (!auth.ok) return { ok: false, response: fromAuthResponse(auth.response) };

  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      response: jsonFrom(request, 503, { error: 'Database service is not configured' }),
    };
  }

  return { ok: true, userId: auth.user.id, admin };
}

export { jsonFrom, preflight, readJson } from './api-response';
