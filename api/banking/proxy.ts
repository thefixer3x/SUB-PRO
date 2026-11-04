/**
 * Vercel handler for /api/banking/proxy.
 *
 * Thin wrapper around server/banking.  Authenticates the user, validates
 * the proxy request body, and forwards to the upstream MCP API.
 *
 * Changed from the original /banking-proxy Netlify function:
 *  - Path is now /api/banking/proxy (native clients set base URL to end in /api)
 *  - CORS is handled by server/cors.ts (no wildcard Access-Control-Allow-Origin)
 */

import { requireUser } from '../../server/auth';
import {
  corsHeaders,
  jsonResponse,
  isOriginAllowed,
  getRequestOrigin,
  type VercelResponse,
} from '../../server/cors';
import { proxyRequest, validateBankingProxyRequestBody } from '../../server/banking';

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

  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return new Response(auth.response.body, {
        status: auth.response.statusCode,
        headers: auth.response.headers,
      });
    }

    const origin = getRequestOrigin(Object.fromEntries(request.headers.entries()));

    const mcpApiKey = process.env.MCP_API_KEY ?? '';
    if (!mcpApiKey) {
      return new Response(JSON.stringify({ error: 'Banking service not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const mcpBaseUrl = process.env.MCP_BASE_URL ?? 'https://api.onasis-gateway.com';

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const validation = validateBankingProxyRequestBody(body);
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const result = await proxyRequest(validation.value, mcpApiKey, mcpBaseUrl, auth.user.id);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
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
