/**
 * Small helpers shared by the P1 Expo Router API routes.
 *
 * `requireUser` returns the same `{ statusCode, headers, body }` shape the
 * Vercel handlers use; these helpers turn it (and plain JSON) into a Response
 * with the shared CORS policy.
 */

import {
  corsHeaders,
  getRequestOrigin,
  isOriginAllowed,
  jsonResponse,
  type JsonResponse,
} from './cors';

export function jsonFrom(request: Request, status: number, data: unknown): Response {
  const origin = getRequestOrigin(Object.fromEntries(request.headers.entries()));
  const response = jsonResponse(status, data, origin);
  return new Response(response.body, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const origin = getRequestOrigin(Object.fromEntries(request.headers.entries()));
  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('', { status: 200, headers: corsHeaders(origin) });
}

export function fromAuthResponse(response: JsonResponse): Response {
  return new Response(response.body, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return {};
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
