/**
 * Thin adapter: netlify/functions/create-checkout-session.ts → api/create-checkout-session.ts.
 *
 * Converts the Netlify event format into a Request and delegates to the
 * Vercel handler.  This file can be retired once Netlify is fully retired.
 */

import vercelHandler from '../../api/create-checkout-session';

interface NetlifyHandlerEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}

interface NetlifyHandlerResponse {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

type NetlifyHandler = (event: NetlifyHandlerEvent) => Promise<NetlifyHandlerResponse>;

const toRequest = (event: NetlifyHandlerEvent): Request => {
  const url = `https://placeholder${event.httpMethod === 'POST' ? '/api/create-checkout-session' : ''}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value) headers.set(key, value);
  }
  return new Request(url, {
    method: event.httpMethod,
    headers,
    body: event.body ?? undefined,
  });
};

const fromResponse = async (
  response: Response,
  event: NetlifyHandlerEvent,
): Promise<NetlifyHandlerResponse> => {
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

export const adapter = async (event: NetlifyHandlerEvent): Promise<NetlifyHandlerResponse> => {
  const request = toRequest(event);
  const response = await vercelHandler(request);
  return fromResponse(response, event);
};

export default adapter;
