/**
 * Vercel handler for /api/create-checkout-session.
 *
 * Thin wrapper around server/ modules.  Takes user id and email from the
 * verified session only (never from the body).  Resolves the price via
 * Stripe lookup_key.  Success/cancel URLs are validated against the
 * allowed origins.
 */

import { requireUser } from '../server/auth';
import { corsHeaders, getAllowedOrigins, jsonResponse, isOriginAllowed, getRequestOrigin } from '../server/cors';
import { ensureStripe } from '../server/stripe';

export const runtime = 'nodejs';

/** Purchasable plans and their Stripe lookup keys (decision D4). */
export const PLAN_LOOKUP_KEYS = {
  pro: 'subtrack_pro_monthly',
  team: 'subtrack_team_monthly',
} as const;

type PurchasablePlan = keyof typeof PLAN_LOOKUP_KEYS;

/**
 * Read `plan` from the JSON body. A missing body or missing `plan` means Pro,
 * which keeps older clients working. Anything else that is not an allowlisted
 * plan returns null and the request is rejected.
 */
async function readPlan(request: Request): Promise<PurchasablePlan | null> {
  let raw: unknown;
  try {
    const text = await request.text();
    if (!text) return 'pro';
    raw = (JSON.parse(text) as { plan?: unknown })?.plan;
  } catch {
    return null;
  }
  if (raw === undefined || raw === null) return 'pro';
  return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(PLAN_LOOKUP_KEYS, raw)
    ? (raw as PurchasablePlan)
    : null;
}

export async function handler(request: Request): Promise<Response> {
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
    return new Response('', {
      status: 200,
      headers: corsHeaders(origin),
    });
  }

  if (request.method !== 'POST') {
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

    // The body may name a plan, but only from a fixed allowlist; the price
    // itself is always resolved server-side through its Stripe lookup key.
    const plan = await readPlan(request);
    if (!plan) {
      return new Response(
        JSON.stringify({ error: `Unknown plan. Expected one of: ${Object.keys(PLAN_LOOKUP_KEYS).join(', ')}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        },
      );
    }
    const lookupKey = PLAN_LOOKUP_KEYS[plan];

    const client = ensureStripe();
    const prices = await client.prices.list({
      lookup_keys: [lookupKey],
      active: true,
    });

    const price = prices.data?.[0];
    // Refuse a price that is not tagged for this app and plan, so a lookup key
    // moved by mistake can never sell another product (see decision D2).
    if (!price || price.metadata?.project !== 'subtrack' || price.metadata?.tier !== plan) {
      console.error(`Checkout price misconfigured for lookup_key=${lookupKey}`);
      return new Response(
        JSON.stringify({ error: `Price not available (lookup_key=${lookupKey})` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        },
      );
    }

    const priceId = price.id;

    const allowedOrigins = getAllowedOrigins();
    const siteUrl = process.env.SITE_URL || allowedOrigins[0];

    const successUrl = `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/billing/cancel`;

    // Validate URLs against allowed origins.
    const successOrigin = new URL(successUrl).origin;
    const cancelOrigin = new URL(cancelUrl).origin;
    if (!allowedOrigins.includes(successOrigin) || !allowedOrigins.includes(cancelOrigin)) {
      return new Response(
        JSON.stringify({ error: 'Invalid redirect URL — not on allowed origins' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        },
      );
    }

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        project: 'subtrack',
        tier: plan,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          project: 'subtrack',
          tier: plan,
        },
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    const headers = Object.fromEntries(request.headers.entries());
    const reqOrigin = getRequestOrigin(headers);
    console.error('Create checkout session error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(reqOrigin) },
      },
    );
  }
}

// Vercel's Node runtime passes a Web Request only to a `fetch` (or GET/POST/...)
// export. A bare default function is called as a Node (req, res) handler and
// crashes ("request.headers.entries is not a function").
export default { fetch: handler };
