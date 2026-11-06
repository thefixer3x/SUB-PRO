/**
 * Thin adapter: netlify/functions/banking-proxy.ts → api/banking/proxy.ts.
 *
 * Converts the Netlify event format into a Request and delegates to the
 * Vercel handler.  This file can be retired once Netlify is fully retired.
 *
 * NOTE: The original function used wildcard CORS (Access-Control-Allow-Origin: *)
 * which is now fixed by routing through server/cors.ts (origin-specific).
 */

import vercelHandler from '../../api/banking/proxy';

/**
 * Canonical (title-cased) spellings for the headers the server layer emits.
 * The Web Headers API lowercases every name on iteration, but the Netlify
 * function contract has always returned canonical names.
 */
const CANONICAL_HEADER_NAMES: Record<string, string> = {
  'Access-Control-Allow-Origin': 'access-control-allow-origin',
  'Access-Control-Allow-Methods': 'access-control-allow-methods',
  'Access-Control-Allow-Headers': 'access-control-allow-headers',
  'Access-Control-Max-Age': 'access-control-max-age',
  'Content-Type': 'content-type',
  Vary: 'vary',
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

const toRequest = (event: NetlifyEvent): Request => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value) headers.set(key, value);
  }
  return new Request('https://placeholder/api/banking/proxy', {
    method: event.httpMethod,
    headers,
    body: event.body ?? undefined,
  });
};

const fromResponse = async (
  response: Response,
  event: NetlifyEvent,
): Promise<NetlifyResult> => {
  const body = await response.text();
  const headers: Record<string, string | undefined> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // The Web Headers API lowercases every name. The Netlify contract (and
  // every existing caller) reads canonical, title-cased header names, so
  // restore the casing the server layer used.
  for (const [canonical, lower] of Object.entries(CANONICAL_HEADER_NAMES)) {
    if (headers[lower] !== undefined) {
      headers[canonical] = headers[lower];
      delete headers[lower];
    }
  }
  if (!event.headers?.origin) {
    delete headers['Access-Control-Allow-Origin'];
  }
  return {
    statusCode: response.status,
    headers,
    body,
  };
};

export const handler = async (
  event: NetlifyEvent,
): Promise<NetlifyResult> => {
  const request = toRequest(event);
  const response = await vercelHandler(request);
  return fromResponse(response, event);
};

export default handler;
