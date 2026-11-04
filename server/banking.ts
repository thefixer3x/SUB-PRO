/**
 * Banking proxy business logic.
 *
 * Validates proxy requests (path allowlist, body shape) and forwards them to
 * the upstream MCP API.  The Netlify function (`banking-proxy.ts`) used to
 * contain this logic inline — it is now here so the `api/banking/proxy` handler
 * can reuse it.
 */

import type { ValidatedBankingProxyRequest } from '../lib/bankingProxy';

export {
  isAllowedBankingProxyPath,
  validateBankingProxyRequestBody,
  normalizeBankingProxyPath,
  type ValidatedBankingProxyRequest,
} from '../lib/bankingProxy';

export interface ProxyResponse {
  data: Record<string, unknown>;
  status: number;
  error?: string;
}

export const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Validate and forward a banking-proxy request.
 *
 * Returns the upstream response as a plain object on success, or an error
 * response (with status code) on failure.
 */
export const proxyRequest = async (
  validated: ValidatedBankingProxyRequest,
  mcpApiKey: string,
  mcpBaseUrl: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string }> => {
  const url = `${mcpBaseUrl}${validated.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${mcpApiKey}`,
  };

  try {
    const fetchInit: RequestInit = {
      method: validated.method,
      headers,
    };
    if (validated.payload) {
      fetchInit.body = JSON.stringify(validated.payload);
    }
    fetchInit.signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(url, fetchInit);
    const data = await upstream.json().catch(() => ({}));
    return { ok: true, data: data as Record<string, unknown> };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message === 'Timeout');
    if (isTimeout) {
      return { ok: false, status: 504, error: 'Upstream banking service timed out' };
    }
    console.error('[server/banking] upstream error:', error);
    return { ok: false, status: 500, error: 'Internal server error' };
  }
};
