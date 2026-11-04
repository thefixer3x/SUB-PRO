/**
 * Shared CORS helpers for Vercel edge / Node functions.
 *
 * Ported from netlify/functions/_shared/cors.ts — same allowlist logic,
 * same origin-echo behaviour.  Browser requests with an unknown origin are
 * rejected (403); non-browser requests (no Origin header) pass through.
 */

export const LOCAL_DEV_ORIGIN = 'http://localhost:5000';

const ALLOWED_METHODS = 'GET,POST,PATCH,OPTIONS,HEAD';
const ALLOWED_HEADERS = 'Content-Type,Authorization';
const PREFLIGHT_MAX_AGE = '86400';

/** Parse the `ALLOWED_ORIGINS` allowlist.  Falls back to local dev only. */
export const getAllowedOrigins = (): string[] => {
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return configured.length > 0 ? configured : [LOCAL_DEV_ORIGIN];
};

/** Read the `Origin` header of a request, if the client sent one. */
export const getRequestOrigin = (headers: Record<string, string | undefined>): string | undefined => {
  const raw = headers.origin ?? headers.Origin;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Requests without an `Origin` header (mobile app, server-to-server, curl)
 * are not browser requests and are not origin restricted.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};

/** CORS response headers.  The origin is echoed only when it is allowed. */
export const corsHeaders = (origin: string | undefined): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': PREFLIGHT_MAX_AGE,
    Vary: 'Origin',
  };
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
};

export interface JsonResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** JSON response carrying the CORS headers for the request origin. */
export const jsonResponse = (
  statusCode: number,
  data: unknown,
  origin: string | undefined,
): JsonResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  },
  body: JSON.stringify(data),
});

export type VercelResponse = Promise<Response>;
