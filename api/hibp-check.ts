/**
 * Vercel handler for /api/hibp-check.
 *
 * Thin wrapper around server/hibp.  Checks the signed-in user's own email
 * against Have I Been Pwned.  The API key is held server-side only.
 */

import { requireUser } from '../server/auth';
import {
  corsHeaders,
  jsonResponse,
  isOriginAllowed,
  getRequestOrigin,
  type VercelResponse,
} from '../server/cors';
import { checkBreach } from '../server/hibp';

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

  if (!['POST', 'GET'].includes(request.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(undefined) },
    });
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

    const apiKey = process.env.HAVEIBEENPWNED_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Breach check is not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const email = auth.user.email;
    if (!email) {
      return new Response(JSON.stringify({ error: 'Account has no email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const result = await checkBreach(email, apiKey);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
