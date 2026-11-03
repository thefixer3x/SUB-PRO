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
            { amount: Math.min(effectiveAmount, 50000), interval: 'per_authorization' },
          ],
          allowed_categories: merchantCategory
            ? [merchantCategory]
            : ['computer_software_stores', 'digital_goods_media', 'online_services'],
          blocked_categories: [
            'betting_casino_gambling',
            'government_licensed_online_casions_online_gambling_us_region_only',
            'automated_cash_disburse',
            'manual_cash_disburse',
          ],
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
      return ok({
        id: `weavr_card_${Date.now()}`,
        subscriptionId,
        userId,
        cardNumber: 'encrypted_card_number',
        last4: '5555',
        expiryMonth: 11,
        expiryYear: 2027,
        cvv: 'encrypted_cvv',
        status: 'active',
        spendingLimit,
        merchantCategory,
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: 'weavr',
        providerCardId: `weavr_${Date.now()}`,
      });
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

    // Stripe paginates globally, so keep scanning until the user page is full
    // (plus one matching card to determine user-visible has_more) or exhausted.
    while (hasMoreGlobalCards && filteredCards.length <= limit) {
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

    const hasMoreUserCards = filteredCards.length > limit;
    const pageCards = filteredCards.slice(0, limit);

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
      next_cursor: hasMoreUserCards ? pageCards[pageCards.length - 1]?.id ?? null : null,
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
    .maybeSingle();

  if (error) {
    console.error('[virtual-cards] Failed to verify card ownership:', error.message);
    return json(503, { error: 'Card ownership service temporarily unavailable' });
  }
  return data ? null : json(403, { error: 'Access denied' });
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

    const client = ensureStripe();
    const payload = event.body ? JSON.parse(event.body) : {};
    const { status, spendingLimits, allowedCategories, blockedCategories } = payload ?? {};

    // First verify ownership
    const existing = await client.issuing.cards.retrieve(cardId);
    if (existing.metadata?.user_id !== userId) {
      return json(403, { error: 'Access denied' });
    }

    const updateParams: Stripe.Issuing.CardUpdateParams = {};

    if (status && ['active', 'inactive', 'canceled'].includes(status)) {
      updateParams.status = status as Stripe.Issuing.Card.Status;
    }

    if (spendingLimits || allowedCategories || blockedCategories) {
      updateParams.spending_controls = {};

      if (Array.isArray(spendingLimits)) {
        updateParams.spending_controls.spending_limits = spendingLimits.map((limit) => ({
          amount: Math.round((limit.amount ?? 0) * 100),
          interval: limit.interval,
        }));
      }

      if (Array.isArray(allowedCategories)) {
        updateParams.spending_controls.allowed_categories = allowedCategories;
      }

      if (Array.isArray(blockedCategories)) {
        updateParams.spending_controls.blocked_categories = blockedCategories;
      }
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
