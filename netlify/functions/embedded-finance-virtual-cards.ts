import Stripe from 'stripe';
import { requireUser, getServiceRoleClient, type NetlifyEvent, type NetlifyResult } from './_shared/auth';
import { handlePreflight } from './_shared/cors';

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
  userSessionEmail?: string,
): Promise<NetlifyResult> => {
  try {
    const client = ensureStripe();
    const payload = event.body ? JSON.parse(event.body) : {};

    // Ignore userId and userEmail from the request body — use the verified session identity instead.
    // Body-supplied userId is never trusted.
    const { provider, subscriptionId, spendingLimit, merchantCategory, userName, userPhone } =
      payload ?? {};

    if (!subscriptionId) {
      return badRequest('Missing required fields');
    }

    // Validate spending limit before any Stripe calls
    if (spendingLimit != null && typeof spendingLimit === 'number' && spendingLimit < 0) {
      return badRequest('Spending limit must be non-negative');
    }

    // Look up the user's billing address from the profile.
    // A missing service-role client means infrastructure is unavailable (500).
    // A query error also means a database failure (503).
    // Missing billing address in a successful query is a client problem (400).
    const profileClient = getServiceRoleClient();
    if (!profileClient) {
      return internalError('Service role client not configured');
    }

    const { data, error } = await profileClient
      .from('profiles')
      .select('billing_address')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[virtual-cards] Failed to look up profile billing address:', error.message);
      return internalError('Failed to look up billing address');
    }

    if (!data) {
      return badRequest('Profile not found. Please contact support.');
    }

    let billingAddress: Record<string, string> | null =
      (data as { billing_address?: Record<string, string> }).billing_address ?? null;

    if (!billingAddress) {
      return badRequest('Billing address is required. Please update your profile.');
    }

    // Validate billing address has all required fields before Stripe call
    const requiredFields: Array<keyof Record<string, string>> = ['line1', 'city', 'postal_code', 'country'];
    for (const field of requiredFields) {
      if (!billingAddress[field]) {
        return badRequest(`Billing address is missing ${field}. Please update your profile.`);
      }
    }

    if (provider === 'stripe') {
      const userEmail = userSessionEmail;
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
        ...(userPhone ? { phone_number: userPhone } : {}),
        billing: {
          address: {
            line1: billingAddress.line1,
            line2: billingAddress.line2,
            city: billingAddress.city,
            state: billingAddress.state,
            country: billingAddress.country,
            postal_code: billingAddress.postal_code,
          },
        },
        metadata: {
          userId,
          subscriptionId,
          customerId: customer.id,
        },
      });

      const amountCents = Math.round((spendingLimit ?? 0) * 100);

      const card = await client.issuing.cards.create({
        cardholder: cardholder.id,
        type: 'virtual',
        currency: 'usd',
        status: 'active',
        spending_controls: {
          spending_limits: [
            {
              amount: amountCents || 10000,
              interval: 'monthly',
            },
            {
              amount: Math.min(amountCents || 10000, 50000),
              interval: 'per_authorization',
            },
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

      const sanitizedCard = {
        id: card.id,
        subscriptionId,
        userId,
        last4: card.last4,
        brand: card.brand,
        status: card.status,
        spendingLimit: spendingLimit,
        currency: card.currency,
        createdAt: new Date(card.created * 1000),
        updatedAt: new Date(),
        provider: 'stripe',
        providerCardId: card.id,
        merchantCategory,
      };

      return ok(sanitizedCard);
    }

    if (provider === 'weavr') {
      const mockCard = {
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
      };

      return ok(mockCard);
    }

    return badRequest('Unsupported provider');
  } catch (error) {
    console.error('Virtual card creation failed:', error);
    return internalError('Internal server error');
  }
};

const ensureCustomer = async (
  client: Stripe,
  params: { userId: string; userEmail?: string; userName?: string; subscriptionId: string }
) => {
  const { userId, userEmail, userName, subscriptionId } = params;

  try {
    if (userEmail) {
      const escapedEmail = userEmail.replace(/'/g, "\\\\'");
      const escapedUserId = userId.replace(/'/g, "\\\\'");
      const existing = await client.customers.search({
        query: `email:'${escapedEmail}' OR metadata['userId']:'${escapedUserId}'`,
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
    const limit = Math.min(parseInt(params.limit ?? '10', 10) || 10, 100);

    const listParams: Stripe.Issuing.CardListParams = {
      limit,
    };

    if (cardholderId) {
      listParams.cardholder = cardholderId;
    }

    if (status && ['active', 'inactive', 'canceled'].includes(status)) {
      listParams.status = status as Stripe.Issuing.Card.Status;
    }

    const cards = await client.issuing.cards.list(listParams);

    const filteredCards = cards.data.filter((card) => card.metadata?.user_id === userId);

    const sanitizedCards = filteredCards.map((card) => ({
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
      has_more: cards.has_more,
      total_count: filteredCards.length,
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

const handleRetrieve = async (cardId: string, userId: string): Promise<NetlifyResult> => {
  try {
    // First verify ownership in our database before calling Stripe.
    const dbClient = getServiceRoleClient();
    if (dbClient) {
      const { data, error } = await dbClient
        .from('virtual_cards')
        .select('stripe_card_id')
        .eq('stripe_card_id', cardId)
        .eq('user_id', userId)
        .single();
      if (error) {
        return internalError('Failed to verify card ownership');
      }
      if (!data) {
        return json(403, { error: 'Access denied' });
      }
    }

    const client = ensureStripe();
    if (!cardId) {
      return badRequest('Card ID is required');
    }

    const card = await client.issuing.cards.retrieve(cardId);

    // Also verify Stripe metadata ownership
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
    // Fail closed: service role client is required for ownership verification.
    const dbClient = getServiceRoleClient();
    if (!dbClient) {
      return internalError('Service role client not configured');
    }

    // Verify ownership in our database before calling Stripe.
    const { data, error } = await dbClient
      .from('virtual_cards')
      .select('stripe_card_id')
      .eq('stripe_card_id', cardId)
      .eq('user_id', userId)
      .single();
    if (error) {
      return internalError('Failed to verify card ownership');
    }
    if (!data) {
      return json(403, { error: 'Access denied' });
    }

    const client = ensureStripe();
    if (!cardId) {
      return badRequest('Card ID is required');
    }

    const payload = event.body ? JSON.parse(event.body) : {};
    const { status, spendingLimits, allowedCategories, blockedCategories } = payload ?? {};

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
  // Handle preflight (CORS)
  if (event.httpMethod === 'OPTIONS' || event.httpMethod === 'HEAD') {
    return handlePreflight(event);
  }

  const segments = parseSegments(event);

  // Enforce origin policy for browser requests before requiring auth.
  // Non-browser requests (mobile, server-to-server) have no Origin header
  // and pass through. Browser requests from unknown origins are rejected.
  const origin = event.headers?.origin ?? event.headers?.Origin;
  const { isOriginAllowed, corsHeaders } = await import('./_shared/cors');
  if (origin && !isOriginAllowed(origin)) {
    return json(403, { error: 'Origin not allowed' }, { 'Access-Control-Allow-Origin': undefined });
  }

  // Require authentication for all non-preflight routes
  const auth = await requireUser(event);
  if (!auth.ok) {
    return auth.response;
  }

  const userId = auth.user.id;
  const userEmail = auth.user.email ?? undefined;

  if (!stripe) {
    return internalError('Stripe is not configured');
  }

  let result: NetlifyResult;

  if (event.httpMethod === 'POST' && segments.length === 1 && segments[0] === 'create') {
    result = await handleCreate(event, userId, userEmail);
  } else if (event.httpMethod === 'GET' && segments.length === 1 && segments[0] === 'list') {
    result = await handleList(event, userId);
  } else if (event.httpMethod === 'GET' && segments.length === 2 && segments[0] === 'user') {
    // Handle user/<id> path: list cards for the authenticated user (ignore the path ID).
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

  // Merge CORS headers into every response
  return {
    ...result,
    headers: {
      ...result.headers,
      ...corsHeaders(origin),
    },
  };
};

export default handler;
