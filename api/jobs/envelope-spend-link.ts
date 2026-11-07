/** Nightly, idempotent job that links recent card authorizations to envelopes. */

import { createSupabaseAdmin } from '../../server/supabase-admin';
import { linkEnvelopeSpend } from '../../server/envelopes';
import { isStripeTestMode } from '../../server/stripe-mode';

export const runtime = 'nodejs';

export async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Require an explicit test-mode key; the linker also filters each row by
  // Stripe's persisted livemode bit (legacy/unknown rows default to live).
  if (!isStripeTestMode()) {
    return Response.json({ ok: true, skipped: 'stripe_test_mode_required' });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Database service is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Re-scan the current month on each run so a missed cron window and
    // pre-deploy authorizations are both recovered. The unique index on
    // card_authorization_id makes overlapping runs safe.
    const now = new Date();
    const result = await linkEnvelopeSpend(admin, {
      since: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[api/jobs/envelope-spend-link] failed:', error);
    return new Response(JSON.stringify({ error: 'Could not link envelope spend' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Match the Web Request handler pattern used by the other Vercel functions.
export default { fetch: handler };
