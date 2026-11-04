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

    // Resolve the price via lookup_key (never from the body).
    const client = ensureStripe();
    const prices = await client.prices.list({
      lookup_keys: ['subtrack_pro_monthly'],
    });

    if (!prices.data?.length) {
      return new Response(
        JSON.stringify({ error: 'Price not found (lookup_key=subtrack_pro_monthly)' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        },
      );
    }

    const priceId = prices.data[0].id;

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
