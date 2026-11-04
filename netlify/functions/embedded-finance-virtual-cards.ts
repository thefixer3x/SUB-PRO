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
  let apiPath = event.path.replace(/^\/netlify\/functions\/embedded-finance-virtual-cards/, '') || '/embedded-finance/virtual-cards';
  const url = `https://placeholder${apiPath}`;
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
