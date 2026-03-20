import { posix as pathPosix } from 'node:path';

export const ALLOWED_BANKING_PROXY_PATHS = [
  '/banking/connect',
  '/banking/transactions',
  '/banking/sync',
  '/banking/disconnect',
  '/ai/detect-subscriptions',
  '/ai/spending-insights',
  '/subscriptions/cancel',
] as const;

export type BankingProxyMethod = 'GET' | 'POST';

export interface ValidatedBankingProxyRequest {
  path: string;
  payload?: Record<string, unknown>;
  method: BankingProxyMethod;
}

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
};

export function normalizeBankingProxyPath(rawPath: string): string | null {
  if (!rawPath || !rawPath.startsWith('/')) {
    return null;
  }

  const [rawPathname, rawSearch = ''] = rawPath.split('?');

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  const normalizedPathname = pathPosix.normalize(decodedPathname);
  if (
    !normalizedPathname.startsWith('/') ||
    normalizedPathname.includes('..')
  ) {
    return null;
  }

  return rawSearch ? `${normalizedPathname}?${rawSearch}` : normalizedPathname;
}

export function isAllowedBankingProxyPath(path: string): string | null {
  const normalizedPath = normalizeBankingProxyPath(path);
  if (!normalizedPath) {
    return null;
  }

  const pathname = normalizedPath.split('?')[0];
  const isAllowed = ALLOWED_BANKING_PROXY_PATHS.some((allowedPath) => {
    return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
  });

  return isAllowed ? normalizedPath : null;
}

export function validateBankingProxyRequestBody(
  body: unknown,
):
  | { ok: true; value: ValidatedBankingProxyRequest }
  | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Invalid request body' };
  }

  if (typeof body.path !== 'string') {
    return { ok: false, error: 'Invalid path' };
  }

  const normalizedPath = isAllowedBankingProxyPath(body.path);
  if (!normalizedPath) {
    return { ok: false, error: 'Invalid path' };
  }

  let resolvedMethod: BankingProxyMethod = 'POST';
  if (body.method !== undefined) {
    if (body.method !== 'GET' && body.method !== 'POST') {
      return { ok: false, error: 'Invalid method' };
    }
    resolvedMethod = body.method;
  }

  if (body.payload !== undefined && !isPlainObject(body.payload)) {
    return { ok: false, error: 'Invalid payload' };
  }

  if (resolvedMethod === 'GET' && body.payload !== undefined) {
    return { ok: false, error: 'GET requests cannot include a payload' };
  }

  return {
    ok: true,
    value: {
      path: normalizedPath,
      payload: body.payload,
      method: resolvedMethod,
    },
  };
}
