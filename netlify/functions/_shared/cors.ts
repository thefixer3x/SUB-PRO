/**
 * Shared CORS helpers for the Netlify functions.
 *
 * The allowlist comes from the `ALLOWED_ORIGINS` environment variable
 * (comma separated). When it is not set we fall back to the local dev origin
 * only, so a missing production setting fails closed instead of opening the
 * API to every website on the internet.
 *
 * Usage:
 *   import { getRequestOrigin, handlePreflight, isOriginAllowed, jsonResponse } from './_shared/cors';
 */

export interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  path?: string;
  rawUrl?: string;
  queryStringParameters?: Record<string, string | undefined>;
}

export interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

/** Local dev origin used when `ALLOWED_ORIGINS` is not configured. */
export const LOCAL_DEV_ORIGIN = 'http://localhost:5000';

const ALLOWED_METHODS = 'GET,POST,PATCH,OPTIONS,HEAD';
const ALLOWED_HEADERS = 'Content-Type,Authorization';
const PREFLIGHT_MAX_AGE = '86400';

/** Parse the `ALLOWED_ORIGINS` allowlist. Falls back to local dev only. */
export const getAllowedOrigins = (): string[] => {
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configured.length > 0 ? configured : [LOCAL_DEV_ORIGIN];
};

/** Read the `Origin` header of a request, if the client sent one. */
export const getRequestOrigin = (event: NetlifyEvent): string | undefined => {
  const headers = event.headers ?? {};
  const raw = headers.origin ?? headers.Origin;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Requests without an `Origin` header (mobile app, server-to-server, curl)
 * are not browser requests and are not origin restricted. Browser requests
 * with an unknown origin are rejected.
 */
export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins().includes(origin);
};

/** CORS response headers. The origin is echoed only when it is allowed. */
export const corsHeaders = (origin?: string): Record<string, string | undefined> => {
  const headers: Record<string, string | undefined> = {
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

/** JSON response carrying the CORS headers for the request origin. */
export const jsonResponse = (
  statusCode: number,
  data: unknown,
  origin?: string,
): NetlifyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  },
  body: JSON.stringify(data),
});

/** Answer a CORS preflight (`OPTIONS`) request. */
export const handlePreflight = (event: NetlifyEvent): NetlifyResult => {
  const origin = getRequestOrigin(event);

  if (!isOriginAllowed(origin)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Origin not allowed' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders(origin),
    body: '',
  };
};
