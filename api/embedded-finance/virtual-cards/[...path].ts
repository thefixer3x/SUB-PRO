/**
 * Vercel handler for /api/embedded-finance/virtual-cards/[...path].
 *
 * Thin wrapper around server/virtual-cards.  Parses the catch-all path,
 * authenticates the user, and dispatches to the correct operation.
 *
 * Routes:
 *   POST   /api/embedded-finance/virtual-cards/create
 *   GET    /api/embedded-finance/virtual-cards/list
 *   GET    /api/embedded-finance/virtual-cards/:cardId
 *   GET    /api/embedded-finance/virtual-cards/user/:userId
 *   PATCH  /api/embedded-finance/virtual-cards/:cardId/update
 */

import { requireUser } from '../../../server/auth';
import {
  corsHeaders,
  getAllowedOrigins,
  jsonResponse,
  isOriginAllowed,
  getRequestOrigin,
  type VercelResponse,
} from '../../../server/cors';
import * as vc from '../../../server/virtual-cards';

export const runtime = 'nodejs';

const json = (status: number, body: unknown, origin: string | undefined) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

export default async function handler(request: Request): Promise<Response> {
  // --- OPTIONS preflight ---
  if (request.method === 'OPTIONS') {
    const headers = Object.fromEntries(request.headers.entries());
    const origin = getRequestOrigin(headers);
    if (!isOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 200, headers: corsHeaders(origin) });
  }

  if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return new Response(auth.response.body, {
        status: auth.response.statusCode,
        headers: auth.response.headers,
      });
    }

    const { id: userId, email } = auth.user;
    const origin = getRequestOrigin(Object.fromEntries(request.headers.entries()));
    const url = new URL(request.url);
    const rawPath = url.pathname.replace(/^\/api\/embedded-finance\/virtual-cards/, '');
    const segments = rawPath
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);

    // --- POST /create ---
    if (request.method === 'POST' && segments.length === 1 && segments[0] === 'create') {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json(400, { error: 'Invalid JSON body' }, origin);
      }

      const validationError = vc.validateCreateCard(body);
      if (validationError) return json(400, { error: validationError }, origin);

      const result = await vc.createCard(userId, email ?? undefined, {
        subscriptionId: body.subscriptionId as string,
        spendingLimit: body.spendingLimit as number | undefined,
        merchantCategory: body.merchantCategory as string | undefined,
        userName: body.userName as string | undefined,
        userPhone: body.userPhone as string | undefined,
        billingAddress: body.billingAddress as CreateCardBillingAddress,
      });

      if (!result.ok) return json(500, { error: result.error }, origin);
      return json(200, result.data, origin);
    }

    // --- GET /list or /user/:userId ---
    if (request.method === 'GET' && segments.length === 1 && segments[0] === 'list') {
      const params = url.searchParams;
      const listResult = await vc.listCards(userId, {
        cardholder: params.get('cardholderId') ?? undefined,
        status: params.get('status') ?? undefined,
        limit: parseInt(params.get('limit') ?? '10', 10) || 10,
        starting_after: params.get('starting_after') ?? undefined,
      });

      // If listResult has an error field (from Stripe error path), return 500
      if ('error' in listResult) {
        return json(500, { error: (listResult as { error: string }).error }, origin);
      }
      return json(200, listResult, origin);
    }

    // GET /user/:userId — same as /list (ignores the userId param)
    if (request.method === 'GET' && segments.length === 2 && segments[0] === 'user') {
      const params = url.searchParams;
      const listResult = await vc.listCards(userId, {
        cardholder: params.get('cardholderId') ?? undefined,
        status: params.get('status') ?? undefined,
        limit: parseInt(params.get('limit') ?? '10', 10) || 10,
        starting_after: params.get('starting_after') ?? undefined,
      });

      if ('error' in listResult) {
        return json(500, { error: (listResult as { error: string }).error }, origin);
      }
      return json(200, listResult, origin);
    }

    // --- GET /:cardId (retrieve) ---
    if (request.method === 'GET' && segments.length === 1) {
      const cardId = segments[0];
      const result = await vc.retrieveCard(cardId, userId);
      if (!result.ok) return json(403, { error: result.error }, origin);
      return json(200, result.data, origin);
    }

    // --- PATCH /:cardId/update ---
    if (request.method === 'PATCH' && segments.length === 2 && segments[1] === 'update') {
      const cardId = segments[0];
      let updates: vc.UpdateCardInput;
      try {
        const raw = JSON.parse(await request.text());
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return json(400, { error: 'Invalid JSON body' }, origin);
        }
        updates = {
          status: raw.status as 'active' | 'inactive' | 'canceled' | undefined,
          spendingLimits: raw.spendingLimits as Array<{ amount: number; interval: string }> | undefined,
          allowedCategories: raw.allowedCategories as string[] | undefined,
          blockedCategories: raw.blockedCategories,
        };
      } catch {
        return json(400, { error: 'Invalid JSON body' }, origin);
      }

      const result = await vc.updateCard(cardId, userId, updates);
      if (!result.ok) return json(400, { error: result.error }, origin);
      return json(200, result.data, origin);
    }

    // --- 404 for unknown routes ---
    return json(404, { error: 'Not Found', path: request.url }, origin);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return json(500, { error: message }, undefined);
  }
}

interface CreateCardBillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}
