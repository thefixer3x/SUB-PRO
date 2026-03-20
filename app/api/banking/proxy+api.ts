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

// Allowed path prefixes the client may request
const ALLOWED_PATHS = [
  '/banking/connect',
  '/banking/transactions',
  '/banking/sync',
  '/banking/disconnect',
  '/ai/detect-subscriptions',
  '/ai/spending-insights',
  '/subscriptions/cancel',
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((p) => path.startsWith(p));
}

export async function POST(request: Request): Promise<Response> {
  if (!MCP_API_KEY) {
    return Response.json(
      { error: 'Banking service not configured' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { path, payload, userId } = body as {
      path: string;
      payload?: Record<string, unknown>;
      userId?: string;
    };

    if (!path || !isAllowedPath(path)) {
      return Response.json({ error: 'Invalid path' }, { status: 400 });
    }

    const isGet = !payload && path.includes('?');
    const url = `${MCP_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MCP_API_KEY}`,
    };
    if (userId) {
      headers['X-User-ID'] = userId;
    }

    const upstream = await fetch(url, {
      method: isGet ? 'GET' : 'POST',
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });

    const data = await upstream.json();

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
