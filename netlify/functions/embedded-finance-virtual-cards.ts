/**
 * Thin adapter: netlify/functions/embedded-finance-virtual-cards.ts →
 * api/embedded-finance/virtual-cards/[...path].ts.
 *
 * Converts the Netlify event format into a Request and delegates to the
 * Vercel handler.  This file can be retired once Netlify is fully retired.
 *
 * The original function contained the full business logic; that has been
 * moved to server/virtual-cards.ts with thin api/ handler wrappers.
 */

import vercelHandler from '../../api/embedded-finance/virtual-cards/[...path]';

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
  path: string;
  queryStringParameters: Record<string, string | undefined>;
}

interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

const toRequest = (event: NetlifyEvent): Request => {
  // Normalize the path to the API route.
  // The event.path may be "/embedded-finance/virtual-cards/list" or include
  // the function prefix "/netlify/functions/embedded-finance-virtual-cards/...".
  // The Vercel handler strips the '/api/embedded-finance/virtual-cards'
  // prefix before routing, so the adapter must hand it a path under that
  // prefix. Netlify's event.path has no '/api' segment, and may or may not
  // carry the '/embedded-finance/virtual-cards' part, so normalise both.
  let apiPath = event.path
    .replace(/^\/netlify\/functions\/embedded-finance-virtual-cards/, '')
    .replace(/^\/api\/embedded-finance\/virtual-cards/, '')
    .replace(/^\/embedded-finance\/virtual-cards/, '');
  if (!apiPath || apiPath === '/') {
    apiPath = '/list';
  }
  const url = `https://placeholder/api/embedded-finance/virtual-cards${apiPath}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value) headers.set(key, value);
  }
  if (event.queryStringParameters) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(event.queryStringParameters)) {
      if (v) search.set(k, v);
    }
    if (search.toString()) {
      const u = new URL(url);
      u.search = search.toString();
      return new Request(u.toString(), {
        method: event.httpMethod,
        headers,
        body: event.body ?? undefined,
      });
    }
  }
  return new Request(url, {
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
