/**
 * Vercel handler for /api/splitwise.
 *
 * Thin wrapper around server/splitwise.  Returns 501 until per-user
 * authorisation is implemented (card S203 follow-up).
 */

import { requireUser } from '../server/auth';
import {
  corsHeaders,
  jsonResponse,
  isOriginAllowed,
  getRequestOrigin,
  type VercelResponse,
} from '../server/cors';
import { handleSplitwise } from '../server/splitwise';

export const runtime = 'nodejs';

export default async function handler(request: Request): Promise<Response> {
  // --- OPTIONS preflight ---
  if (request.method === 'OPTIONS') {
    const headers = Object.fromEntries(request.headers.entries());
    const origin = getRequestOrigin(headers);
    if (!isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 200, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // A browser request from an origin outside the allowlist is rejected
  // outright, before authentication. The original Netlify functions did
  // this for every method, not just the preflight.
  const requestOrigin = getRequestOrigin(Object.fromEntries(request.headers.entries()));
  if (!isOriginAllowed(requestOrigin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return new Response(auth.response.body, {
        status: auth.response.statusCode,
        headers: auth.response.headers,
      });
    }

    const origin = getRequestOrigin(Object.fromEntries(request.headers.entries()));
    const result = await handleSplitwise();

    return new Response(
      JSON.stringify({ error: result.error }),
      {
        status: result.statusCode,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
