/**
 * Thin adapter: netlify/functions/splitwise-api.ts → api/splitwise.ts.
 *
 * Converts the Netlify event format into a Request and delegates to the
 * Vercel handler.  This file can be retired once Netlify is fully retired.
 */

import vercelHandler from '../../api/splitwise';

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
  return new Request('https://placeholder/api/splitwise', {
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
