import Stripe from 'stripe';
import { getServiceRoleClient, requireUser, type NetlifyEvent, type NetlifyResult } from './_shared/auth';
import { corsHeaders, getRequestOrigin, handlePreflight, isOriginAllowed } from './_shared/cors';

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  console.warn('STRIPE_SECRET_KEY is not set. Netlify functions for embedded finance will fail until it is configured.');
}

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: '2025-08-27.basil',
    })
  : undefined;

const json = (statusCode: number, data: unknown, headers?: Record<string, string | undefined>): NetlifyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  body: JSON.stringify(data),
});

const ok = (data: unknown): NetlifyResult => json(200, data);
const badRequest = (message: string): NetlifyResult => json(400, { error: message });
const internalError = (message: string): NetlifyResult => json(500, { error: message });

const parseSegments = (event: NetlifyEvent): string[] => {
  const path = event.path || '';
  const segments = path.split('/').filter(Boolean);

  const embeddedIndex = segments.findIndex((segment) => segment === 'embedded-finance');
  if (embeddedIndex >= 0 && segments[embeddedIndex + 1] === 'virtual-cards') {
    return segments.slice(embeddedIndex + 2);
  }

  const fnIndex = segments.findIndex((segment) => segment === 'embedded-finance-virtual-cards');
  if (fnIndex >= 0) {
    return segments.slice(fnIndex + 1);
  }

  return [];
};

// Merchant categories a subscription card may be limited to. Anything else
// (gambling, cash disbursement, transfers) stays blocked by the allowlist.
const ALLOWED_CARD_CATEGORIES = [
  'computer_software_stores',
  'digital_goods_media',
  'digital_goods_applications',
  'digital_goods_games',
  'digital_goods_large_volume',
  'cable_satellite_and_other_pay_television_and_radio',
  'computer_network_services',
  'telecommunication_services',
  'direct_marketing_subscription',
] as const;
type CardCategory = (typeof ALLOWED_CARD_CATEGORIES)[number];
const DEFAULT_ALLOWED_CATEGORIES: CardCategory[] = [
  'computer_software_stores',
  'digital_goods_media',
  'digital_goods_applications',
];
const isAllowedCategory = (value: unknown): value is CardCategory =>
  typeof value === 'string' && (ALLOWED_CARD_CATEGORIES as readonly string[]).includes(value);

const ALLOWED_LIMIT_INTERVALS = ['per_authorization', 'daily', 'weekly', 'monthly', 'yearly'] as const;
type LimitInterval = (typeof ALLOWED_LIMIT_INTERVALS)[number];
const MAX_PER_AUTHORIZATION_CENTS = 50000;
const MAX_LIMIT_CENTS = 500000;
const MAX_SPENDING_LIMITS = 5;
// Upper bound on Stripe list calls per request (Stripe paginates the whole account).
const MAX_LIST_SCAN_PAGES = 5;

type UpdateControls = Stripe.Issuing.CardUpdateParams.SpendingControls;

/** Validate client-supplied card controls. Returns an error message or the Stripe params. */
const parseUpdateControls = (payload: Record<string, unknown>): string | UpdateControls | null => {
  const { spendingLimits, allowedCategories, blockedCategories } = payload;
  if (blockedCategories !== undefined) {
    return 'blockedCategories is not supported; use allowedCategories';
  }
  if (spendingLimits === undefined && allowedCategories === undefined) return null;

  const controls: UpdateControls = {};

  if (allowedCategories !== undefined) {
    if (!Array.isArray(allowedCategories) || allowedCategories.length === 0 ||
      !allowedCategories.every(isAllowedCategory)) {
      return 'allowedCategories must be a non-empty list of supported categories';
    }
    controls.allowed_categories = [...new Set(allowedCategories)] as UpdateControls['allowed_categories'];
  }

  if (spendingLimits !== undefined) {
    if (!Array.isArray(spendingLimits) || spendingLimits.length === 0 ||
      spendingLimits.length > MAX_SPENDING_LIMITS) {
      return `spendingLimits must have 1-${MAX_SPENDING_LIMITS} entries`;
    }
    const limits: UpdateControls['spending_limits'] = [];
    for (const raw of spendingLimits) {
      const limit = raw as { amount?: unknown; interval?: unknown } | null;
      const amount = limit?.amount;
      const interval = limit?.interval;
      if (typeof interval !== 'string' || !(ALLOWED_LIMIT_INTERVALS as readonly string[]).includes(interval)) {
        return 'Unsupported spending limit interval';
      }
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return 'Spending limit amounts must be positive numbers';
      }
      const cents = Math.round(amount * 100);
      if (cents <= 0) {
        return 'Spending limit amounts must be at least 0.01';
      }
      const cap = interval === 'per_authorization' ? MAX_PER_AUTHORIZATION_CENTS : MAX_LIMIT_CENTS;
      if (cents > cap) {
        return 'Spending limit exceeds the maximum allowed';
      }
      limits.push({ amount: cents, interval: interval as LimitInterval });
    }
    controls.spending_limits = limits;
  }

  return controls;
};

const ensureStripe = () => {
  if (!stripe) {
    throw new Error('Stripe client is not configured. Set STRIPE_SECRET_KEY in the environment.');
  }
  return stripe;
};

const handleCreate = async (
  event: NetlifyEvent,
  userId: string,
  userEmail?: string,
): Promise<NetlifyResult> => {
  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    const client = ensureStripe();
    const {
      provider,
      subscriptionId,
      spendingLimit,
      merchantCategory,
      userName,
      userPhone,
      billingAddress,
    } = payload ?? {};

    if (!subscriptionId) {
      return badRequest('Missing required fields');
    }

    if (spendingLimit != null &&
      (typeof spendingLimit !== 'number' || !Number.isFinite(spendingLimit) || spendingLimit < 0)) {
      return badRequest('Spending limit must be non-negative');
    }

    if (spendingLimit != null && Math.round(spendingLimit * 100) > MAX_LIMIT_CENTS) {
      return badRequest('Spending limit exceeds the maximum allowed');
    }

    if (merchantCategory != null && !isAllowedCategory(merchantCategory)) {
      return badRequest('Unsupported merchant category');
    }

    if (provider === 'stripe') {
      const address = billingAddress as Record<string, unknown> | undefined;
      const requiredAddressFields = ['line1', 'city', 'postal_code', 'country'] as const;
      if (!address || requiredAddressFields.some((field) =>
        typeof address[field] !== 'string' || !address[field]?.trim())) {
        return badRequest('A valid billing address is required');
      }

      const customer = await ensureCustomer(client, {
        userId,
        userEmail,
        userName,
        subscriptionId,
      });

      const cardholder = await client.issuing.cardholders.create({
        type: 'individual',
        name: userName || `User ${userId}`,
        email: userEmail || customer.email || `user-${userId}@subtrack-pro.lanonasis.com`,
        ...(typeof userPhone === 'string' && userPhone.trim() ? { phone_number: userPhone.trim() } : {}),
        billing: {
          address: {
            line1: address.line1 as string,
            line2: typeof address.line2 === 'string' ? address.line2 : undefined,
            city: address.city as string,
            state: typeof address.state === 'string' ? address.state : undefined,
            country: address.country as string,
            postal_code: address.postal_code as string,
          },
        },
        metadata: {
          userId,
          subscriptionId,
          customerId: customer.id,
        },
      });

      const amountCents = Math.round((spendingLimit ?? 0) * 100);
      const effectiveAmount = amountCents || 10000;
      const card = await client.issuing.cards.create({
        cardholder: cardholder.id,
        type: 'virtual',
        currency: 'usd',
        status: 'active',
        spending_controls: {
          spending_limits: [
            { amount: effectiveAmount, interval: 'monthly' },
            { amount: Math.min(effectiveAmount, MAX_PER_AUTHORIZATION_CENTS), interval: 'per_authorization' },
          ],
          // Stripe rejects allowed_categories together with blocked_categories.
          // An allowlist blocks every other category, including gambling and cash.
          allowed_categories: merchantCategory
            ? [merchantCategory as Stripe.Issuing.CardCreateParams.SpendingControls.AllowedCategory]
            : [...DEFAULT_ALLOWED_CATEGORIES],
        },
        metadata: {
          subscription_id: subscriptionId,
          user_id: userId,
          customer_id: customer.id,
          cardholder_id: cardholder.id,
          purpose: 'subscription_payment',
          created_via: 'subtrack_pro_app',
        },
      });

      // Record ownership now so the owner can manage the card immediately; the
      // issuing_card.created webhook writes the same row idempotently as a backstop.
      await recordCardReference(userId, card, subscriptionId);

      return ok({
        id: card.id,
        subscriptionId,
        userId,
        last4: card.last4,
        brand: card.brand,
        status: card.status,
        spendingLimit,
        currency: card.currency,
        createdAt: new Date(card.created * 1000),
        updatedAt: new Date(),
        provider: 'stripe',
        providerCardId: card.id,
        merchantCategory,
      });
    }

    if (provider === 'weavr') {
      // No Weavr integration exists yet; never return a placeholder card.
      return json(501, { error: 'Provider not available' });
    }

    return badRequest('Unsupported provider');
  } catch (error) {
    console.error('Virtual card creation failed:', error);
    return internalError('Internal server error');
  }
};

const escapeStripeSearchValue = (value: string): string =>
  value.replace(/'/g, String.fromCharCode(92) + "'");

const ensureCustomer = async (
  client: Stripe,
  params: { userId: string; userEmail?: string; userName?: string; subscriptionId: string }
) => {
  const { userId, userEmail, userName, subscriptionId } = params;

  try {
    if (userEmail) {
      const existing = await client.customers.search({
        query: `email:'${escapeStripeSearchValue(userEmail)}' OR metadata['userId']:'${escapeStripeSearchValue(userId)}'`,
        limit: 1,
      });

      if (existing.data[0]) {
        return existing.data[0];
      }
    }
  } catch (error) {
    console.error('Failed to search for existing Stripe customer:', error);
  }

  return client.customers.create({
    email: userEmail,
    name: userName,
    metadata: {
      userId,
      subscriptionId,
    },
  });
};

const handleList = async (event: NetlifyEvent, userId: string): Promise<NetlifyResult> => {
  try {
    const client = ensureStripe();
    const params = event.queryStringParameters ?? {};
    const { cardholderId, status } = params;
    const limit = Math.max(1, Math.min(parseInt(params.limit ?? '10', 10) || 10, 100));

    const listParams: Stripe.Issuing.CardListParams = { limit };

    if (cardholderId) {
      listParams.cardholder = cardholderId;
    }

    if (status && ['active', 'inactive', 'canceled'].includes(status)) {
      listParams.status = status as Stripe.Issuing.Card.Status;
    }

    if (params.starting_after) {
      listParams.starting_after = params.starting_after;
    }

    const filteredCards: Stripe.Issuing.Card[] = [];
    let hasMoreGlobalCards = true;
    let lastScannedCardId = listParams.starting_after;
    let pagesScanned = 0;

    // Stripe paginates globally, so keep scanning until the user page is full
    // (plus one matching card to determine user-visible has_more), Stripe is
    // exhausted, or the per-request page budget runs out.
    while (hasMoreGlobalCards && filteredCards.length <= limit && pagesScanned < MAX_LIST_SCAN_PAGES) {
      pagesScanned += 1;
      const cards = await client.issuing.cards.list({
        ...listParams,
        ...(lastScannedCardId ? { starting_after: lastScannedCardId } : {}),
      });

      const lastCard = cards.data[cards.data.length - 1];
      if (!lastCard || lastCard.id === lastScannedCardId) {
        // Stop on an empty/non-advancing page to avoid an infinite loop if the
        // upstream pagination response is inconsistent.
        hasMoreGlobalCards = false;
      } else {
        lastScannedCardId = lastCard.id;
        filteredCards.push(...cards.data.filter((card) => card.metadata?.user_id === userId));
        hasMoreGlobalCards = cards.has_more;
      }
    }

    const pageFull = filteredCards.length > limit;
    const budgetExhausted = !pageFull && hasMoreGlobalCards;
    const hasMoreUserCards = pageFull || budgetExhausted;
    const pageCards = filteredCards.slice(0, limit);
    // A full page resumes after its last card; an exhausted budget resumes after
    // the last card scanned, so the next request continues the global scan.
    const nextCursor = pageFull
      ? pageCards[pageCards.length - 1]?.id ?? null
      : budgetExhausted
        ? lastScannedCardId ?? null
        : null;

    const sanitizedCards = pageCards.map((card) => ({
      id: card.id,
      status: card.status,
      type: card.type,
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cardholder: card.cardholder,
      spending_controls: {
        spending_limits:
          card.spending_controls?.spending_limits?.map((limit) => ({
            amount: limit.amount ? limit.amount / 100 : null,
            interval: limit.interval,
          })) ?? [],
        allowed_categories: card.spending_controls?.allowed_categories,
        blocked_categories: card.spending_controls?.blocked_categories,
      },
      created: card.created,
      metadata: {
        subscription_id: card.metadata?.subscription_id,
        user_id: card.metadata?.user_id,
        purpose: card.metadata?.purpose,
      },
      currency: card.currency,
    }));

    return ok({
      cards: sanitizedCards,
      has_more: hasMoreUserCards,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error('Failed to list virtual cards:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return json(error.statusCode || 400, {
        error: `Stripe error: ${error.message}`,
        type: error.type,
      });
    }

    return internalError('Failed to list cards');
  }
};


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Insert the virtual_cards ownership row unless it already exists. Never throws. */
const recordCardReference = async (
  userId: string,
  card: Pick<Stripe.Issuing.Card, 'id' | 'last4' | 'brand' | 'status'> & {
    cardholder?: Stripe.Issuing.Card['cardholder'];
  },
  subscriptionId?: string,
): Promise<boolean> => {
  const dbClient = getServiceRoleClient();
  if (!dbClient) {
    console.error('[virtual-cards] Cannot record card reference: service client not configured');
    return false;
  }
  try {
    const { data: existing, error: readError } = await dbClient
      .from('virtual_cards')
      .select('card_id')
      .eq('card_id', card.id)
      .limit(1);
    if (readError) throw readError;
    if (Array.isArray(existing) && existing.length > 0) return true;

    const cardholderId = typeof card.cardholder === 'string' ? card.cardholder : card.cardholder?.id;
    const { error: insertError } = await dbClient.from('virtual_cards').insert({
      user_id: userId,
      card_id: card.id,
      cardholder_id: cardholderId ?? null,
      last4: card.last4,
      brand: card.brand,
      status: card.status,
      subscription_id: subscriptionId && UUID_RE.test(subscriptionId) ? subscriptionId : null,
    });
    if (insertError) throw insertError;
    return true;
  } catch (error) {
    console.error('[virtual-cards] Failed to record card reference:', (error as { message?: string })?.message ?? error);
    return false;
  }
};

const verifyCardOwnership = async (cardId: string, userId: string): Promise<NetlifyResult | null> => {
  const dbClient = getServiceRoleClient();
  if (!dbClient) {
    return internalError('Card ownership service is not configured');
  }

  const { data, error } = await dbClient
    .from('virtual_cards')
    .select('card_id')
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('[virtual-cards] Failed to verify card ownership:', error.message);
    return json(503, { error: 'Card ownership service temporarily unavailable' });
  }
  return Array.isArray(data) && data.length > 0 ? null : json(403, { error: 'Access denied' });
};

const handleRetrieve = async (cardId: string, userId: string): Promise<NetlifyResult> => {
  try {
    if (!cardId) {
      return badRequest('Card ID is required');
    }
    const ownershipFailure = await verifyCardOwnership(cardId, userId);
    if (ownershipFailure) return ownershipFailure;

    const client = ensureStripe();
    const card = await client.issuing.cards.retrieve(cardId);

    // Verify ownership: only return the card if it belongs to this user
    if (card.metadata?.user_id !== userId) {
      return json(403, { error: 'Access denied' });
    }

    const sanitizedCard = {
      id: card.id,
      status: card.status,
      type: card.type,
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cardholder: {
        id: card.cardholder,
        name: (card.cardholder as any)?.name,
        email: (card.cardholder as any)?.email,
      },
      spending_controls: card.spending_controls,
      created: card.created,
      metadata: card.metadata,
      currency: card.currency,
    };

    return ok(sanitizedCard);
  } catch (error) {
    console.error('Failed to retrieve virtual card:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return json(error.statusCode || 400, {
        error: `Stripe error: ${error.message}`,
        type: error.type,
      });
    }

    return internalError('Failed to retrieve card details');
  }
};

const handleUpdate = async (cardId: string, event: NetlifyEvent, userId: string): Promise<NetlifyResult> => {
  try {
    if (!cardId) {
      return badRequest('Card ID is required');
    }
    const ownershipFailure = await verifyCardOwnership(cardId, userId);
    if (ownershipFailure) return ownershipFailure;

    let payload: Record<string, unknown>;
    try {
      const parsed = event.body ? JSON.parse(event.body) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return badRequest('Invalid JSON body');
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return badRequest('Invalid JSON body');
    }

    const { status } = payload;
    if (status !== undefined && !(typeof status === 'string' && ['active', 'inactive', 'canceled'].includes(status))) {
      return badRequest('Unsupported status');
    }
    const controls = parseUpdateControls(payload);
    if (typeof controls === 'string') {
      return badRequest(controls);
    }

    const updateParams: Stripe.Issuing.CardUpdateParams = {};
    if (status !== undefined) {
      updateParams.status = status as Stripe.Issuing.CardUpdateParams.Status;
    }
    if (controls) {
      updateParams.spending_controls = controls;
    }
    if (Object.keys(updateParams).length === 0) {
      return badRequest('Nothing to update');
    }

    const client = ensureStripe();
    // Second ownership check against the card's own metadata.
    const existing = await client.issuing.cards.retrieve(cardId);
    if (existing.metadata?.user_id !== userId) {
      return json(403, { error: 'Access denied' });
    }

    const updatedCard = await client.issuing.cards.update(cardId, updateParams);

    const sanitizedCard = {
      id: updatedCard.id,
      status: updatedCard.status,
      spending_controls: updatedCard.spending_controls,
      last4: updatedCard.last4,
      metadata: updatedCard.metadata,
      updated: Date.now(),
    };

    return ok({
      success: true,
      card: sanitizedCard,
      message: 'Card updated successfully',
    });
  } catch (error) {
    console.error('Failed to update virtual card:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return json(error.statusCode || 400, {
        error: `Stripe error: ${error.message}`,
        type: error.type,
      });
    }

    return internalError('Failed to update card');
  }
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  if (event.httpMethod === 'OPTIONS' || event.httpMethod === 'HEAD') {
    return handlePreflight(event);
  }

  const origin = getRequestOrigin(event);
  if (!isOriginAllowed(origin)) {
    return json(403, { error: 'Origin not allowed' });
  }

  const segments = parseSegments(event);
  const auth = await requireUser(event);
  if (!auth.ok) {
    return {
      ...auth.response,
      headers: { ...auth.response.headers, ...corsHeaders(origin) },
    };
  }

  const userId = auth.user.id;
  let result: NetlifyResult;

  if (!stripe) {
    result = internalError('Stripe is not configured');
  } else if (event.httpMethod === 'POST' && segments.length === 1 && segments[0] === 'create') {
    result = await handleCreate(event, userId, auth.user.email ?? undefined);
  } else if (event.httpMethod === 'GET' && segments.length === 1 && segments[0] === 'list') {
    result = await handleList(event, userId);
  } else if (event.httpMethod === 'GET' && segments.length === 2 && segments[0] === 'user') {
    result = await handleList(event, userId);
  } else if (event.httpMethod === 'GET' && segments.length === 1) {
    result = await handleRetrieve(decodeURIComponent(segments[0]), userId);
  } else if (event.httpMethod === 'PATCH' && segments.length === 2 && segments[1] === 'update') {
    result = await handleUpdate(decodeURIComponent(segments[0]), event, userId);
  } else {
    result = json(404, {
      error: 'Not Found',
      path: event.path,
      segments,
    });
  }

  return {
    ...result,
    headers: { ...result.headers, ...corsHeaders(origin) },
  };
};

export default handler;
