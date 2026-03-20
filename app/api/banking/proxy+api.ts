import { createClient } from '@supabase/supabase-js';
import { validateBankingProxyRequestBody } from '@/lib/bankingProxy';

/**
 * Server-side proxy for MCP Banking API.
 *
 * The MCP bearer token (MCP_API_KEY) is only available here on the server.
 * Client code calls this route instead of the external API directly so
 * the secret never ships in the JS bundle.
 */

const MCP_API_KEY = process.env.MCP_API_KEY ?? '';
const MCP_BASE_URL =
  process.env.MCP_BASE_URL ?? 'https://api.onasis-gateway.com';
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const UPSTREAM_TIMEOUT_MS = 10_000;

async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[banking/proxy] Supabase auth env missing for token validation');
    return null;
  }

  const accessToken = authHeader.slice('Bearer '.length).trim();
  if (!accessToken) {
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    console.warn('[banking/proxy] Invalid user token', error);
    return null;
  }

  return data.user.id;
}

export async function POST(request: Request): Promise<Response> {
  if (!MCP_API_KEY) {
    return Response.json(
      { error: 'Banking service not configured' },
      { status: 503 },
    );
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json(
      { error: 'Authentication service not configured' },
      { status: 503 },
    );
  }

  try {
    const authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = validateBankingProxyRequestBody(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const { path, payload, method } = validation.value;
    const url = `${MCP_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MCP_API_KEY}`,
      'X-User-ID': authenticatedUserId,
    };

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method,
        headers,
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
      ) {
        return Response.json(
          { error: 'Upstream banking service timed out' },
          { status: 504 },
        );
      }

      throw error;
    }

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return Response.json(data, { status: upstream.status });
    }

    return Response.json(data);
  } catch (error) {
    console.error('[banking/proxy] error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
