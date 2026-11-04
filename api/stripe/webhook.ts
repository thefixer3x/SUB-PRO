/**
 * Vercel handler for /api/stripe/webhook.
 *
 * Reads the raw body with `await request.text()` and verifies the
 * Stripe signature.  For subscription/invoice/checkout events returns
 * 200 and skips (log why) when the price's `metadata.project !== 'subtrack'`.
 * `issuing_*` events are never skipped — they are the only writers of
 * `virtual_cards` / `card_authorizations`.
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

// Track processed event ids for idempotency.
const processedEvents = new Set<string>();

export default async function handler(request: Request): Promise<Response> {
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

  // Idempotency: skip already-processed events.
  const eventId = stripeEvent.id;
  if (processedEvents.has(eventId)) {
    console.log(`Skipping already-processed event: ${eventId}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  processedEvents.add(eventId);

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
): Promise<{ status: number; body: string } | undefined> {
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

/** Subscription events: check project metadata, skip foreign projects. */
async function handleSubscriptionEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{ status: number; body: string } | undefined> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

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
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const project = (priceObj.metadata?.project as string) ?? '';

  // Skip events for other projects.
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  // Get customer to find user_id.
  let customerIdStr = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  let userId: string | null = null;

  try {
    const customer = await stripe.customers.retrieve(customerIdStr);
    if ('deleted' in customer && customer.deleted) {
      console.log(`Skipping ${event.type}: customer ${customerIdStr} is deleted`);
      return { status: 200, body: JSON.stringify({ received: true }) };
    }
    userId = (customer as Stripe.Customer).metadata?.user_id ?? null;
  } catch {
    // If we can't retrieve the customer, skip silently.
    console.warn(`Could not retrieve customer ${customerIdStr} for subscription event`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  if (!userId) {
    // Try to find user by stripe_customer_id in profiles.
    const adminClient = createSupabaseAdmin();
    if (adminClient) {
      const { data } = await adminClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerIdStr)
        .single();
      userId = (data as { id: string } | null)?.id ?? null;
    }
  }

  if (!userId) {
    console.error(`No user ID found for subscription ${subscription.id}`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  // Determine tier from price metadata (D1=(b)).
  const tier = getTierFromPrice(priceObj);

  // Apply the tier change using the service role client.
  const adminClient = createSupabaseAdmin();
  if (adminClient) {
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
      console.error(`Failed to update subscription_tier for user ${userId}:`, error.message);
    } else {
      console.log(`Updated subscription_tier for user ${userId}:`, updateData.subscription_tier);
    }
  }

  return { status: 200, body: JSON.stringify({ received: true }) };
}

/** Invoice events: skip foreign projects, record payments for SubTrack. */
async function handleInvoiceEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{ status: number; body: string } | undefined> {
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
  } catch {
    console.warn(`Could not retrieve subscription ${subscriptionId} for invoice event`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const price = sub.items.data[0]?.price;
  if (!price) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const priceId = typeof price === 'string' ? price : price.id;
  let priceObj: Stripe.Price;
  try {
    priceObj = await stripe.prices.retrieve(priceId);
  } catch {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const project = (priceObj.metadata?.project as string) ?? '';
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  // Get userId and record payment.
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId: string | null = null;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) {
      return { status: 200, body: JSON.stringify({ received: true }) };
    }
    userId = (customer as Stripe.Customer).metadata?.user_id ?? null;
  } catch {
    console.warn(`Could not retrieve customer ${customerId} for invoice event`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  if (!userId) {
    const adminClient = createSupabaseAdmin();
    if (adminClient) {
      const { data } = await adminClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      userId = (data as { id: string } | null)?.id ?? null;
    }
  }

  if (!userId) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  // Store the payment record.
  const adminClient = createSupabaseAdmin();
  if (adminClient) {
    const isSucceeded = event.type === 'invoice.payment_succeeded';
    const { error } = await adminClient.from('sm_payment_records').insert({
      user_id: userId,
      stripe_invoice_id: invoice.id,
      amount: invoice.total || 0,
      currency: invoice.currency || 'usd',
      status: isSucceeded ? 'succeeded' : 'failed',
      subscription_id: subscriptionId,
      created_at: new Date().toISOString(),
    } as Record<string, unknown>);

    if (error) {
      console.error(`Failed to store payment record for invoice ${invoice.id}:`, error.message);
    }
  }

  return { status: 200, body: JSON.stringify({ received: true }) };
}

/** checkout.session.completed: idempotent, set subscription tier from price metadata. */
async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{ status: number; body: string } | undefined> {
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.metadata?.user_id ?? null;

  if (!userId) {
    console.error('checkout.session.completed: no user_id in session metadata');
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  // Retrieve the subscription to get the price.
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    console.warn('checkout.session.completed: no subscription ID in session');
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    console.warn(`Could not retrieve subscription ${subscriptionId} for checkout.session.completed`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const price = sub.items.data[0]?.price;
  if (!price) {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const priceId = typeof price === 'string' ? price : price.id;
  let priceObj: Stripe.Price;
  try {
    priceObj = await stripe.prices.retrieve(priceId);
  } catch {
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const project = (priceObj.metadata?.project as string) ?? '';
  if (project && project !== 'subtrack') {
    console.log(`Skipping ${event.type}: price project is '${project}', expected 'subtrack'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: `project=${project} !== 'subtrack'` }) };
  }

  // D1=(b): Set subscription_tier from price metadata.tier.
  const tier = getTierFromPrice(priceObj);
  if (tier) {
    const adminClient = createSupabaseAdmin();
    if (adminClient) {
      const { error } = await adminClient
        .from('profiles')
        .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.error(`Failed to set subscription_tier for user ${userId}:`, error.message);
      } else {
        console.log(`Set subscription_tier to '${tier}' for user ${userId} via checkout.session.completed`);
      }
    }
  }

  return { status: 200, body: JSON.stringify({ received: true }) };
}

/** issuing_card.created: only writer of virtual_cards / card_authorizations. */
async function handleIssuingCardCreated(
  _stripe: Stripe,
  event: Stripe.Event,
): Promise<{ status: number; body: string } | undefined> {
  const card = event.data.object as Stripe.Issuing.Card;

  const userId = card.metadata?.user_id ?? null;
  if (!userId) {
    console.error('No user ID in issuing_card.created metadata:', card.id);
    // Throw so Stripe retries.
    throw new Error(`No user_id in issuing_card ${card.id}`);
  }

  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    throw new Error('Supabase admin client not available');
  }

  // Idempotent insert: skip if row already exists.
  const { data: existing } = await adminClient
    .from('virtual_cards')
    .select('card_id')
    .eq('card_id', card.id)
    .limit(1);

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

  if (error) {
    console.error(`Failed to store virtual card ${card.id}:`, error.message);
    throw new Error(`Failed to store virtual card reference: ${card.id}`);
  }

  console.log(`Stored virtual card ${card.id} for user ${userId}`);
  return { status: 200, body: JSON.stringify({ received: true }) };
}

/** issuing_authorization.created: only writer of card_authorizations. */
async function handleIssuingAuthorizationCreated(
  _stripe: Stripe,
  event: Stripe.Event,
): Promise<{ status: number; body: string } | undefined> {
  const auth = event.data.object as Stripe.Issuing.Authorization;

  const cardId = typeof auth.card === 'string' ? auth.card : auth.card.id;

  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    throw new Error('Supabase admin client not available');
  }

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

  if (error) {
    console.error(`Failed to store card authorization ${auth.id}:`, error.message);
    throw new Error(`Failed to store card authorization: ${auth.id}`);
  }

  console.log(`Stored card authorization ${auth.id}`);
  return { status: 200, body: JSON.stringify({ received: true }) };
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
