/**
 * Vercel handler for /api/stripe/webhook.
 *
 * Reads the raw body with `await request.text()` and verifies the
 * Stripe signature.  For subscription/invoice/checkout events returns
 * 200 and skips (log why) when the price's `metadata.project !== 'subtrack'`.
 * `issuing_*` events are never skipped — they are the only writers of
 * `virtual_cards` / `card_authorizations`.
 *
 * Idempotency is database-backed and runs as claim -> effect -> mark done
 * (see supabase/migrations/20261107000001_webhook_idempotency.sql). An effect
 * that fails releases the claim and returns 500, so Stripe's retry can apply
 * it. A finished event returns 200 without touching the target tables.
 *
 * D1=(b): sets `profiles.subscription_tier` through the service role from
 * the price's `metadata.tier` — never from the product/plan name.  Writes
 * nothing to `user_tiers` or `stripe_subscriptions`.
 */

import Stripe from 'stripe';
import { ensureStripe } from '../../server/stripe';
import { createSupabaseAdmin } from '../../server/supabase-admin';
import { getRequestOrigin, jsonResponse } from '../../server/cors';

export const runtime = 'nodejs';

const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'checkout.session.completed',
  'issuing_card.created',
  'issuing_authorization.created',
] as const;

type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

type HandlerResult = { status: number; body: string } | undefined;
type ClaimResult = 'claimed' | 'duplicate' | 'in_progress';

// Stripe ids (sub_…) are not UUIDs. `sm_payment_records.subscription_id` is a
// uuid column, so passing the Stripe id straight through fails the insert.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asUuid = (value: string | null | undefined): string | null =>
  value && UUID_RE.test(value) ? value : null;

export async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Webhook secret not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const stripe = ensureStripe();

  // Read the raw body for signature verification.
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    const headers = Object.fromEntries(request.headers.entries());
    const origin = getRequestOrigin(headers);
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...jsonResponse(400, {}, origin).headers } },
    );
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    console.error('Webhook signature verification failed:', message);
    const headers = Object.fromEntries(request.headers.entries());
    const origin = getRequestOrigin(headers);
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...jsonResponse(400, {}, origin).headers } },
    );
  }

  const eventType: WebhookEventType = stripeEvent.type as WebhookEventType;

  // Only handle known event types.
  if (!(WEBHOOK_EVENTS as readonly string[]).includes(eventType)) {
    console.log(`Unhandled event type: ${stripeEvent.type}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('Received Stripe webhook:', eventType);

  try {
    const result = await handleEvent(stripe, stripeEvent);

    if (result) {
      // Result from handlers: { status, body } — unwrap to Response directly.
      return new Response(result.body, {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle a single Stripe event.  Returns a response object only when
 * we need to return early (e.g. skip foreign project).  `undefined` means
 * "proceed to 200 response at the end of the handler".
 */
async function handleEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return await handleSubscriptionEvent(stripe, event);

    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      return await handleInvoiceEvent(stripe, event);

    case 'checkout.session.completed':
      return await handleCheckoutSessionCompleted(stripe, event);

    case 'issuing_card.created':
      return await handleIssuingCardCreated(stripe, event);

    case 'issuing_authorization.created':
      return await handleIssuingAuthorizationCreated(stripe, event);

    default:
      return undefined;
  }
}

/**
 * Claim the event, run the effect, then mark it done.
 *
 * `duplicate` and `in_progress` both return 200: the former has already been
 * applied, the latter is being applied by another invocation. A thrown effect
 * releases the claim so Stripe's retry can run it again.
 */
async function runIdempotently(
  event: Stripe.Event,
  run: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const claim = await claimWebhookEvent(event.id, event.type);

  if (claim !== 'claimed') {
    console.log(`Skipping ${event.type} ${event.id}: ${claim}`);
    return {
      status: 200,
      body: JSON.stringify({ received: true, skipped: claim }),
    };
  }

  try {
    const result = await run();
    await markWebhookEventDone(event.id);
    return result;
  } catch (error) {
    await releaseWebhookEvent(event.id);
    throw error;
  }
}

/** Subscription events: check project metadata, skip foreign projects. */
async function handleSubscriptionEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  // Retrieve the price to check project metadata.
  const price = subscription.items.data[0]?.price;
  if (!price) {
    // No price attached — cannot check project metadata.
    console.warn('No price found for subscription event', subscription.id);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const priceId = typeof price === 'string' ? price : price.id;
  let priceObj: Stripe.Price;
  try {
    priceObj = await stripe.prices.retrieve(priceId);
  } catch (e) {
    console.error('Failed to retrieve price for subscription event:', e);
    // Throw so Stripe retries. Returning 200 here would drop the event.
    throw e;
  }

  const project = (priceObj.metadata?.project as string) ?? '';

  // Skip events for other projects. No claim is written for a skipped event.
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  return await runIdempotently(event, async () => {
    // Get customer to find user_id.
    const customerIdStr = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
    let userId: string | null = null;

    let customer: Stripe.Customer | Stripe.DeletedCustomer;
    try {
      customer = await stripe.customers.retrieve(customerIdStr);
    } catch (error) {
      console.error(`Could not retrieve customer ${customerIdStr} for subscription event`, error);
      // Transient Stripe failure: throw so Stripe retries.
      throw error;
    }

    if ('deleted' in customer && customer.deleted) {
      console.log(`Skipping ${event.type}: customer ${customerIdStr} is deleted`);
      return { status: 200, body: JSON.stringify({ received: true }) };
    }
    userId = (customer as Stripe.Customer).metadata?.user_id ?? null;

    if (!userId) {
      // Try to find user by stripe_customer_id in profiles.
      const adminClient = getAdminClient();
      const { data, error } = await adminClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerIdStr)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw new Error(`profile lookup failed: ${error.message}`);
      }
      userId = (data as { id: string } | null)?.id ?? null;
    }

    if (!userId) {
      console.error(`No user ID found for subscription ${subscription.id}`);
      return { status: 200, body: JSON.stringify({ received: true }) };
    }

    // Determine tier from price metadata (D1=(b)).
    const tier = getTierFromPrice(priceObj);

    // Apply the tier change using the service role client.
    const adminClient = getAdminClient();
    const status = subscription.status;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status === 'canceled' || status === 'unpaid') {
      updateData.subscription_tier = 'free';
    } else {
      updateData.subscription_tier = tier ?? 'pro';
    }

    const { error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update subscription_tier for user ${userId}: ${error.message}`);
    }

    console.log(`Updated subscription_tier for user ${userId}:`, updateData.subscription_tier);
    return { status: 200, body: JSON.stringify({ received: true }) };
  });
}

/** Invoice events: skip foreign projects, record payments for SubTrack. */
async function handleInvoiceEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  const invoice = event.data.object as Stripe.Invoice;
  const subRef = (invoice as unknown as { subscription?: string | null }).subscription;
  const subscriptionId = subRef ?? '';

  if (!subscriptionId) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  // Retrieve the subscription to get the price.
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.warn(`Could not retrieve subscription ${subscriptionId} for invoice event`, error);
    throw error;
  }

  const price = sub.items.data[0]?.price;
  if (!price) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const priceId = typeof price === 'string' ? price : price.id;
  let priceObj: Stripe.Price;
  try {
    priceObj = await stripe.prices.retrieve(priceId);
  } catch (error) {
    throw error;
  }

  const project = (priceObj.metadata?.project as string) ?? '';
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  return await runIdempotently(event, async () => {
    // Get userId and record payment.
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    let userId: string | null = null;

    let customer: Stripe.Customer | Stripe.DeletedCustomer;
    try {
      customer = await stripe.customers.retrieve(customerId);
    } catch (error) {
      console.warn(`Could not retrieve customer ${customerId} for invoice event`, error);
      throw error;
    }

    if ('deleted' in customer && customer.deleted) {
      return { status: 200, body: JSON.stringify({ received: true }) };
    }
    userId = (customer as Stripe.Customer).metadata?.user_id ?? null;

    if (!userId) {
      const adminClient = getAdminClient();
      const { data, error } = await adminClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      if (error && error.code !== 'PGRST116') {
        throw new Error(`profile lookup failed: ${error.message}`);
      }
      userId = (data as { id: string } | null)?.id ?? null;
    }

    if (!userId) {
      return { status: 200, body: JSON.stringify({ received: true }) };
    }

    // Store the payment record. The (stripe_invoice_id, status) unique index
    // makes a replay safe if a stale claim is ever reclaimed.
    const adminClient = getAdminClient();
    const isSucceeded = event.type === 'invoice.payment_succeeded';
    const { error } = await adminClient.from('sm_payment_records').insert({
      user_id: userId,
      stripe_invoice_id: invoice.id,
      amount: invoice.total || 0,
      currency: invoice.currency || 'usd',
      status: isSucceeded ? 'succeeded' : 'failed',
      subscription_id: asUuid(subscriptionId),
      created_at: new Date().toISOString(),
    } as Record<string, unknown>);

    if (error && error.code !== '23505') {
      throw new Error(`Failed to store payment record for invoice ${invoice.id}: ${error.message}`);
    }

    return { status: 200, body: JSON.stringify({ received: true }) };
  });
}

/** checkout.session.completed: idempotent, set subscription tier from price metadata. */
async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.metadata?.user_id ?? null;

  if (!userId) {
    console.error('checkout.session.completed: no user_id in session metadata');
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  // Retrieve the subscription to get the price.
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) {
    console.warn('checkout.session.completed: no subscription ID in session');
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.warn(`Could not retrieve subscription ${subscriptionId} for checkout.session.completed`, error);
    throw error;
  }

  const price = sub.items.data[0]?.price;
  if (!price) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const priceId = typeof price === 'string' ? price : price.id;
  let priceObj: Stripe.Price;
  try {
    priceObj = await stripe.prices.retrieve(priceId);
  } catch (error) {
    throw error;
  }

  const project = (priceObj.metadata?.project as string) ?? '';
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  return await runIdempotently(event, async () => {
    // D1=(b): Set subscription_tier from price metadata.tier.
    const tier = getTierFromPrice(priceObj);
    if (tier) {
      const adminClient = getAdminClient();
      const { error } = await adminClient
        .from('profiles')
        .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to set subscription_tier for user ${userId}: ${error.message}`);
      }
      console.log(`Set subscription_tier to '${tier}' for user ${userId} via checkout.session.completed`);
    }

    return { status: 200, body: JSON.stringify({ received: true }) };
  });
}

/** issuing_card.created: only writer of virtual_cards / card_authorizations. */
async function handleIssuingCardCreated(
  _stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  return await runIdempotently(event, async () => {
    const card = event.data.object as Stripe.Issuing.Card;

    const userId = card.metadata?.user_id ?? null;
    if (!userId) {
      // Throw so Stripe retries once the metadata is fixed.
      throw new Error(`No user_id in issuing_card ${card.id}`);
    }

    const adminClient = getAdminClient();

    // Secondary guard: skip if the card row already exists.
    const { data: existing, error: selectError } = await adminClient
      .from('virtual_cards')
      .select('card_id')
      .eq('card_id', card.id)
      .limit(1);

    if (selectError) {
      throw new Error(`Failed to check virtual card ${card.id}: ${selectError.message}`);
    }

    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`virtual_card ${card.id} already exists for user ${userId}`);
      return { status: 200, body: JSON.stringify({ received: true }) };
    }

    const { error } = await adminClient.from('virtual_cards').insert({
      user_id: userId,
      card_id: card.id,
      last4: card.last4,
      brand: card.brand,
      status: card.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>);

    if (error && error.code !== '23505') {
      throw new Error(`Failed to store virtual card reference: ${card.id}: ${error.message}`);
    }

    console.log(`Stored virtual card ${card.id} for user ${userId}`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  });
}

/** issuing_authorization.created: only writer of card_authorizations. */
async function handleIssuingAuthorizationCreated(
  _stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  return await runIdempotently(event, async () => {
    const auth = event.data.object as Stripe.Issuing.Authorization;
    const cardId = typeof auth.card === 'string' ? auth.card : auth.card.id;
    const adminClient = getAdminClient();

    const { error } = await adminClient.from('card_authorizations').insert({
      stripe_authorization_id: auth.id,
      stripe_card_id: cardId,
      amount: auth.amount,
      currency: auth.currency,
      merchant_name: (auth.merchant_data as { name?: string })?.name || 'Unknown',
      merchant_category: (auth.merchant_data as { category?: string })?.category || 'general',
      approved: auth.approved ?? false,
      transaction_date: new Date(auth.created * 1000).toISOString(),
      created_at: new Date().toISOString(),
    } as Record<string, unknown>);

    if (error && error.code !== '23505') {
      throw new Error(`Failed to store card authorization: ${auth.id}: ${error.message}`);
    }

    console.log(`Stored card authorization ${auth.id}`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  });
}

// ---------------------------------------------------------------------------
// Idempotency helpers (RPCs live in 20261107000001_webhook_idempotency.sql)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    throw new Error('Supabase admin client not available');
  }
  return adminClient;
}

async function claimWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<ClaimResult> {
  const adminClient = getAdminClient();
  const { data, error } = await adminClient.rpc('claim_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
  });

  if (error) {
    // Fail closed: without the claim we cannot guarantee dedup.
    throw new Error(`webhook claim failed for ${eventId}: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result === 'claimed' || result === 'duplicate' || result === 'in_progress') {
    return result;
  }
  throw new Error(`webhook claim returned an unexpected result for ${eventId}: ${String(result)}`);
}

async function markWebhookEventDone(eventId: string): Promise<void> {
  const adminClient = createSupabaseAdmin();
  if (!adminClient) return;
  const { error } = await adminClient.rpc('mark_webhook_event_done', { p_event_id: eventId });
  if (error) {
    // The effect already ran. Log and return 200 rather than retrying and
    // risking a duplicate; a stale claim will be reclaimed after the window.
    console.error(`Failed to mark webhook event ${eventId} done: ${error.message}`);
  }
}

async function releaseWebhookEvent(eventId: string): Promise<void> {
  const adminClient = createSupabaseAdmin();
  if (!adminClient) return;
  const { error } = await adminClient.rpc('release_webhook_event', { p_event_id: eventId });
  if (error) {
    console.error(`Failed to release webhook event ${eventId}: ${error.message}`);
  }
}

/** Extract the tier from a Stripe Price's metadata.tier field. */
function getTierFromPrice(price: Stripe.Price): string | null {
  const tier = price.metadata?.tier as string | undefined;
  if (tier && ['free', 'pro', 'team'].includes(tier)) {
    return tier as 'free' | 'pro' | 'team';
  }
  // Fallback: derive from nickname if metadata.tier is missing.
  const nickname = price.nickname ?? '';
  const lower = nickname.toLowerCase();
  if (lower.includes('team')) return 'team';
  if (lower.includes('pro') || lower.includes('premium')) return 'pro';
  return 'free';
}

// Vercel's Node runtime passes a Web Request only to a `fetch` (or GET/POST/...)
// export. A bare default function is called as a Node (req, res) handler and
// crashes ("request.headers.entries is not a function").
export default { fetch: handler };
