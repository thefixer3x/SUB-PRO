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
 * (see supabase/migrations/20261107000003_webhook_claim_idempotency.sql). Each
 * claim has a fencing token so a stale invocation cannot release or complete
 * a newer attempt. An effect or completion failure returns 500 for retry.
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
type ClaimResult =
  | { status: 'claimed'; token: string }
  | { status: 'duplicate' | 'in_progress'; token: null };

// Stripe ids (sub_…) are not UUIDs. `sm_payment_records.subscription_id` is a
// uuid column, so passing the Stripe id straight through fails the insert.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asUuid = (value: string | null | undefined): string | null =>
  value && UUID_RE.test(value) ? value : null;

/** Verify a Stripe webhook and dispatch only the allowlisted event types. */
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
  // Claim before Stripe or database reads so duplicate deliveries are cheap.
  // Project ownership is checked in the effect; foreign-project events are
  // still acknowledged and recorded as completed without applying an effect.
  return runIdempotently(event, () => handleEventEffect(stripe, event));
}

/** Run the side effect for a previously claimed Stripe event. */
async function handleEventEffect(
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
 * Completed duplicates return 200. An in-progress claim throws so Stripe
 * retries. Effect and completion failures release only this attempt's token.
 */
async function runIdempotently(
  event: Stripe.Event,
  run: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const claim = await claimWebhookEvent(event.id, event.type);

  if (claim.status === 'duplicate') {
    console.log(`Skipping completed ${event.type} ${event.id}`);
    return {
      status: 200,
      body: JSON.stringify({ received: true, skipped: 'duplicate' }),
    };
  }
  if (claim.status === 'in_progress') {
    // A 2xx would stop Stripe retries even if the current invocation later
    // fails. Let Stripe retry until this attempt completes or becomes stale.
    throw new Error(`webhook event ${event.id} is already in progress`);
  }
  if (claim.status !== 'claimed' || !claim.token) {
    throw new Error(`webhook claim for ${event.id} did not include an ownership token`);
  }
  const claimToken = claim.token;

  try {
    const result = await run();
    const completed = await markWebhookEventDone(event.id, claimToken);
    if (!completed) {
      throw new Error(`webhook claim ownership changed before completion: ${event.id}`);
    }
    return result;
  } catch (error) {
    await releaseWebhookEvent(event.id, claimToken);
    throw error;
  }
}

/**
 * Apply the current Stripe subscription state, not the possibly stale event
 * snapshot. The billing-state RPC rejects older subscription/event tuples.
 */
async function handleSubscriptionEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  const eventSubscription = event.data.object as Stripe.Subscription;
  const eventPrice = await getPriceForSubscription(stripe, eventSubscription);
  if (!eventPrice) {
    console.warn('No price found for subscription event', eventSubscription.id);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }
  if (eventPrice.metadata?.project !== 'subtrack') {
    console.log(`Skipping ${event.type}: foreign price project '${eventPrice.metadata?.project ?? ''}'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: 'foreign_project' }) };
  }

  const customerId = typeof eventSubscription.customer === 'string'
    ? eventSubscription.customer
    : eventSubscription.customer.id;
  const userId = eventSubscription.metadata?.user_id
    ?? await resolveUserIdForCustomer(stripe, customerId);
  if (!userId) throw new Error(`No user ID found for subscription ${eventSubscription.id}`);
  const sync = await beginSubscriptionTierSync(getAdminClient(), userId);

  let subscription: Stripe.Subscription;
  let priceObj: Stripe.Price;
  if (sync.needsSync) {
    const latest = await findLatestSubtrackSubscription(stripe, customerId);
    if (latest) {
      subscription = latest.subscription;
      priceObj = latest.price;
    } else {
      const current = await stripe.subscriptions.retrieve(eventSubscription.id);
      const currentPrice = await getPriceForSubscription(stripe, current);
      if (!currentPrice || currentPrice.metadata?.project !== 'subtrack') {
        return { status: 200, body: JSON.stringify({ received: true, skipped: 'no_current_subtrack_subscription' }) };
      }
      subscription = current;
      priceObj = currentPrice;
    }
  } else {
    subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
    const currentPrice = await getPriceForSubscription(stripe, subscription);
    if (!currentPrice || currentPrice.metadata?.project !== 'subtrack') {
      return { status: 200, body: JSON.stringify({ received: true, skipped: 'foreign_project' }) };
    }
    priceObj = currentPrice;
  }

  const tier = subscription.status === 'canceled' || subscription.status === 'unpaid'
    ? 'free'
    : (getTierFromPrice(priceObj) ?? 'pro');
  const outcome = await applySubscriptionTierEvent(
    getAdminClient(), userId, sync.generation, subscription, event, tier,
  );
  if (outcome === 'stale') {
    console.log(`Skipping stale subscription event ${event.id} for ${subscription.id}`);
    return { status: 200, body: JSON.stringify({ received: true, skipped: 'stale' }) };
  }

  console.log(`Updated subscription_tier for user ${userId}:`, tier);
  return { status: 200, body: JSON.stringify({ received: true }) };
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
  const priceObj = await stripe.prices.retrieve(priceId);
  if (priceObj.metadata?.project !== 'subtrack') {
    console.log(`Skipping ${event.type}: foreign price project '${priceObj.metadata?.project ?? ''}'`);
    return { status: 200, body: JSON.stringify({ skipped: true, reason: 'foreign_project' }) };
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.user_id
    ?? await resolveUserIdForCustomer(stripe, customerId);
  if (!userId) {
    console.warn(`No user ID found for invoice ${invoice.id}`);
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const adminClient = getAdminClient();
  const isSucceeded = event.type === 'invoice.payment_succeeded';
  const { error } = await adminClient.from('sm_payment_records').insert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    stripe_event_id: event.id,
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
}

/** checkout.session.completed: idempotent, set subscription tier from price metadata. */
async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) {
    console.warn('checkout.session.completed: no subscription ID in session');
    return { status: 200, body: JSON.stringify({ received: true }) };
  }

  const sessionUserId = session.metadata?.user_id ?? null;
  let sessionCustomerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id ?? null;
  if (!sessionCustomerId) {
    const sessionSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    sessionCustomerId = typeof sessionSubscription.customer === 'string'
      ? sessionSubscription.customer
      : sessionSubscription.customer.id;
  }

  const userId = sessionUserId ?? await resolveUserIdForCustomer(stripe, sessionCustomerId);
  if (!userId) throw new Error(`No SubTrack user found for checkout session ${session.id}`);
  const sync = await beginSubscriptionTierSync(getAdminClient(), userId);

  let subscription: Stripe.Subscription;
  let priceObj: Stripe.Price;
  if (sync.needsSync) {
    const latest = await findLatestSubtrackSubscription(stripe, sessionCustomerId);
    if (!latest) {
      return { status: 200, body: JSON.stringify({ received: true, skipped: 'no_current_subtrack_subscription' }) };
    }
    subscription = latest.subscription;
    priceObj = latest.price;
  } else {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentPrice = await getPriceForSubscription(stripe, subscription);
    if (!currentPrice || currentPrice.metadata?.project !== 'subtrack') {
      return { status: 200, body: JSON.stringify({ received: true, skipped: 'foreign_project' }) };
    }
    priceObj = currentPrice;
  }

  const tier = subscription.status === 'canceled' || subscription.status === 'unpaid'
    ? 'free'
    : (getTierFromPrice(priceObj) ?? 'pro');
  const outcome = await applySubscriptionTierEvent(
    getAdminClient(), userId, sync.generation, subscription, event, tier,
  );
  if (outcome === 'stale') {
    console.log(`Skipping stale checkout event ${event.id} for ${subscriptionId}`);
    return { status: 200, body: JSON.stringify({ received: true, skipped: 'stale' }) };
  }

  console.log(`Set subscription_tier to '${tier}' for user ${userId} via checkout.session.completed`);
  return { status: 200, body: JSON.stringify({ received: true }) };
}

/** issuing_card.created: only writer of virtual_cards / card_authorizations. */
async function handleIssuingCardCreated(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
  let card = event.data.object as Stripe.Issuing.Card;
  let userId = card.metadata?.user_id ?? null;
  if (!userId) {
    // The create response may have returned before metadata propagation.
    card = await stripe.issuing.cards.retrieve(card.id);
    userId = card.metadata?.user_id ?? null;
  }
  if (!userId) throw new Error(`No user_id in issuing_card ${card.id}`);

  const adminClient = getAdminClient();
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
}

/** issuing_authorization.created: only writer of card_authorizations. */
async function handleIssuingAuthorizationCreated(
  _stripe: Stripe,
  event: Stripe.Event,
): Promise<HandlerResult> {
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
    livemode: event.livemode,
    transaction_date: new Date(auth.created * 1000).toISOString(),
    created_at: new Date().toISOString(),
  } as Record<string, unknown>);

  if (error && error.code !== '23505') {
    throw new Error(`Failed to store card authorization: ${auth.id}: ${error.message}`);
  }

  console.log(`Stored card authorization ${auth.id}`);
  return { status: 200, body: JSON.stringify({ received: true }) };
}

// ---------------------------------------------------------------------------
// Idempotency and billing-state RPCs live in 20261107000003.
// ---------------------------------------------------------------------------

/** Return a configured service-role client or fail closed. */
function getAdminClient() {
  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    throw new Error('Supabase admin client not available');
  }
  return adminClient;
}

/** Resolve a customer to the SubTrack profile, preferring Stripe metadata. */
async function resolveUserIdForCustomer(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return null;

  const metadataUserId = (customer as Stripe.Customer).metadata?.user_id;
  if (metadataUserId) return metadataUserId;

  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed for customer ${customerId}: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

/** Return the first item's fully hydrated price for a subscription. */
async function getPriceForSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<Stripe.Price | null> {
  const priceRef = subscription.items.data[0]?.price;
  if (!priceRef) return null;
  if (typeof priceRef === 'string') return stripe.prices.retrieve(priceRef);
  if (typeof priceRef.metadata?.project === 'string') return priceRef;
  return stripe.prices.retrieve(priceRef.id);
}

/** Find the newest SubTrack subscription across all pages for initial sync. */
async function findLatestSubtrackSubscription(
  stripe: Stripe,
  customerId: string,
): Promise<{ subscription: Stripe.Subscription; price: Stripe.Price } | null> {
  let startingAfter: string | undefined;
  let latest: { subscription: Stripe.Subscription; price: Stripe.Price } | null = null;

  while (true) {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const subscription of page.data) {
      const price = await getPriceForSubscription(stripe, subscription);
      if (!price || price.metadata?.project !== 'subtrack') continue;
      if (
        !latest ||
        subscription.created > latest.subscription.created ||
        (subscription.created === latest.subscription.created && subscription.id > latest.subscription.id)
      ) {
        latest = { subscription, price };
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return latest;
}

/** Allocate a per-user generation to fence concurrent billing synchronizations. */
async function beginSubscriptionTierSync(
  adminClient: ReturnType<typeof getAdminClient>,
  userId: string,
): Promise<{ generation: number; needsSync: boolean }> {
  const { data, error } = await adminClient.rpc('begin_subscription_tier_sync', {
    p_user_id: userId,
  });
  if (error) throw new Error(`Could not begin subscription sync for ${userId}: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const result = row as { sync_status?: unknown; generation?: unknown; needs_sync?: unknown } | null;
  if (result?.sync_status === 'missing_profile') {
    throw new Error(`Profile ${userId} is missing before subscription sync`);
  }
  if (
    result?.sync_status !== 'claimed' ||
    typeof result.generation !== 'number' ||
    typeof result.needs_sync !== 'boolean'
  ) {
    throw new Error(`Subscription sync RPC returned an unexpected result for ${userId}`);
  }
  return { generation: result.generation, needsSync: result.needs_sync };
}

/** Persist only the current generation and a non-older subscription state. */
async function applySubscriptionTierEvent(
  adminClient: ReturnType<typeof getAdminClient>,
  userId: string,
  generation: number,
  subscription: Stripe.Subscription,
  event: Stripe.Event,
  tier: string,
): Promise<'applied' | 'stale'> {
  const { data, error } = await adminClient.rpc('apply_subscription_tier_event', {
    p_user_id: userId,
    p_generation: generation,
    p_subscription_id: subscription.id,
    p_subscription_created: subscription.created,
    p_event_id: event.id,
    p_tier: tier,
  });
  if (error) {
    throw new Error(`Failed to apply subscription event ${event.id}: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result === 'applied' || result === 'stale') return result;
  if (result === 'superseded') {
    // A newer sync for this user started meanwhile. Throwing releases the
    // claim and returns 500, so Stripe redelivers the event and it is applied
    // under the new generation (or rejected as stale by subscription order).
    throw new Error(`Subscription event ${event.id} was superseded by a newer sync; retrying`);
  }
  if (result === 'missing_profile') {
    throw new Error(`Profile ${userId} is missing for subscription event ${event.id}`);
  }
  throw new Error(`Subscription event RPC returned unexpected result: ${String(result)}`);
}

/** Acquire a token-fenced claim before running any webhook effect. */
/** Claim an event and return the unique token fencing this attempt. */
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

  const row = Array.isArray(data) ? data[0] : data;
  const result = row as { claim_status?: unknown; claim_token?: unknown } | null;
  if (result?.claim_status === 'claimed' && typeof result.claim_token === 'string') {
    return { status: 'claimed', token: result.claim_token };
  }
  if (result?.claim_status === 'duplicate' || result?.claim_status === 'in_progress') {
    return { status: result.claim_status, token: null };
  }
  throw new Error(`webhook claim returned an unexpected result for ${eventId}: ${JSON.stringify(row)}`);
}

/** Complete only the claim attempt whose token still owns the event. */
/** Mark an event complete only if the supplied token still owns its claim. */
async function markWebhookEventDone(eventId: string, claimToken: string): Promise<boolean> {
  const { data, error } = await getAdminClient().rpc('mark_webhook_event_done', {
    p_event_id: eventId,
    p_claim_token: claimToken,
  });
  if (error) throw new Error(`Failed to mark webhook event ${eventId} done: ${error.message}`);
  return data === true;
}

/** Release only this attempt's unfinished claim after an effect failure. */
/** Release a failed attempt without changing a newer owner's claim. */
async function releaseWebhookEvent(eventId: string, claimToken: string): Promise<void> {
  const { data, error } = await getAdminClient().rpc('release_webhook_event', {
    p_event_id: eventId,
    p_claim_token: claimToken,
  });
  if (error) {
    console.error(`Failed to release webhook event ${eventId}: ${error.message}`);
  } else if (data !== true) {
    console.warn(`Webhook claim ${eventId} is no longer owned by this attempt; release skipped`);
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
