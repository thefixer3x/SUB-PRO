import { createClient } from '@supabase/supabase-js';
import { validateBankingProxyRequestBody } from '../../lib/bankingProxy';

const MCP_API_KEY = process.env.MCP_API_KEY ?? '';
const MCP_BASE_URL =
  process.env.MCP_BASE_URL ?? 'https://api.onasis-gateway.com';
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const UPSTREAM_TIMEOUT_MS = 10_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}

interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

const json = (statusCode: number, data: unknown): NetlifyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
  },
  body: JSON.stringify(data),
});

const getAuthenticatedUserId = async (
  authHeader?: string,
): Promise<string | null> => {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[netlify/banking-proxy] Supabase auth env missing');
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
    console.warn('[netlify/banking-proxy] Invalid user token', error);
    return null;
  }

  return data.user.id;
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  if (!MCP_API_KEY) {
    return json(503, { error: 'Banking service not configured' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(503, { error: 'Authentication service not configured' });
  }

  const authenticatedUserId = await getAuthenticatedUserId(
    event.headers.authorization ?? event.headers.Authorization,
  );
  if (!authenticatedUserId) {
    return json(401, { error: 'Authentication required' });
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const validation = validateBankingProxyRequestBody(body);
  if (!validation.ok) {
    return json(400, { error: validation.error });
  }

  const { path, payload, method } = validation.value;
  const url = `${MCP_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${MCP_API_KEY}`,
    'X-User-ID': authenticatedUserId,
  };

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await upstream.json().catch(() => ({}));
    return json(upstream.status, data);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      return json(504, { error: 'Upstream banking service timed out' });
    }

    console.error('[netlify/banking-proxy] error:', error);
    return json(500, { error: 'Internal server error' });
  }
};

export default handler;
