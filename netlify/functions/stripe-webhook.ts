/**
 * Thin adapter: netlify/functions/stripe-webhook.ts → api/stripe/webhook.ts.
 *
 * Converts the Netlify event format into a Request and delegates to the
 * Vercel handler.  This file can be retired once Netlify is fully retired.
 */

import { handler as vercelHandler } from '../../api/stripe/webhook';

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
}

const getRawBody = (event: NetlifyEvent): string => {
  if (!event.body) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return event.body;
};

const toRequest = (event: NetlifyEvent): Request => {
  const rawBody = getRawBody(event);
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (value) headers.set(key, value);
  }
  return new Request('https://placeholder/api/stripe/webhook', {
    method: event.httpMethod,
    headers,
    body: rawBody,
  });
};

const fromResponse = async (
  response: Response,
): Promise<NetlifyResult> => {
  const body = await response.text();
  const headers: Record<string, string | undefined> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    statusCode: response.status,
    headers,
    body,
  };
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  const request = toRequest(event);
  const response = await vercelHandler(request);
  return fromResponse(response);
};

export default handler;
