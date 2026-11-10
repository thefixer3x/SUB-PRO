/**
 * Virtual-cards business logic.
 *
 * Ported from netlify/functions/embedded-finance-virtual-cards.ts — same
 * validation, allowlist, ownership checks and Stripe operations.
 *
 * Exports pure functions that take/return plain objects.
 * API handlers in `api/` are thin: parse request, call here, shape response.
 */

import Stripe from 'stripe';
import { ensureStripe } from './stripe';
import { createSupabaseAdmin } from './supabase-admin';

// ── types ──────────────────────────────────────────────────────────────────

export interface CreateCardInput {
  subscriptionId: string;
  spendingLimit?: number;
  merchantCategory?: string;
  userName?: string;
  userPhone?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
}

export interface UpdateCardInput {
  status?: 'active' | 'inactive' | 'canceled';
  spendingLimits?: Array<{ amount: number; interval: string }>;
  allowedCategories?: string[];
  blockedCategories?: unknown;
}

export interface ListCardsInput {
  cardholder?: string;
  status?: string;
  limit?: number;
  starting_after?: string;
}

export interface SanitizedCard {
  id: string;
  status: string;
  type: string;
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
  cardholder?: unknown;
  spending_controls: Record<string, unknown>;
  created: number;
  metadata: Record<string, unknown>;
  currency: string;
}

export interface ListResponse {
  cards: SanitizedCard[];
  has_more: boolean;
  next_cursor: string | null;
  error?: string;
}

export interface CreateCardOutput {
  id: string;
  subscriptionId: string;
  userId: string;
  last4: string;
  brand: string;
  status: string;
  spendingLimit?: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  provider: string;
  providerCardId: string;
  merchantCategory?: string;
}

export interface ErrorResponse {
  error: string;
  type?: string;
}

export interface UpdateCardOutput {
  success: true;
  card: Partial<SanitizedCard> & { updated: number };
  message: string;
}

// ── constants ──────────────────────────────────────────────────────────────

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
const VALID_SPENDING_LIMIT_INTERVALS = ['monthly', 'weekly', 'daily', 'per_authorization'] as const;
const DEFAULT_ALLOWED_CATEGORIES: CardCategory[] = [
  'computer_software_stores',
  'digital_goods_media',
  'digital_goods_applications',
];
const MAX_SPENDING_LIMITS = 5;
const MAX_LIST_SCAN_PAGES = 5;
const MAX_PER_AUTHORIZATION_CENTS = 50_000;
const MAX_LIMIT_CENTS = 500_000;

// ── validation ─────────────────────────────────────────────────────────────

const isAllowedCategory = (value: unknown): value is CardCategory =>
  typeof value === 'string' &&
  (ALLOWED_CARD_CATEGORIES as readonly string[]).includes(value);

export const parseUpdateControls = (payload: UpdateCardInput): string | null => {
  const { spendingLimits, allowedCategories, blockedCategories } = payload;
  if (blockedCategories !== undefined) {
    return 'blockedCategories is not supported; use allowedCategories';
  }
  if (spendingLimits === undefined && allowedCategories === undefined) {
    return null;
  }

  const controls: { spending_limits?: { amount: number; interval: string }[]; allowed_categories?: CardCategory[] } = {};

  if (allowedCategories !== undefined) {
    if (
      !Array.isArray(allowedCategories) ||
      allowedCategories.length === 0 ||
      !allowedCategories.every(isAllowedCategory)
    ) {
      return 'allowedCategories must be a non-empty list of supported categories';
    }
    controls.allowed_categories = [...new Set(allowedCategories)] as CardCategory[];
  }

  if (spendingLimits !== undefined) {
    if (
      !Array.isArray(spendingLimits) ||
      spendingLimits.length === 0 ||
      spendingLimits.length > MAX_SPENDING_LIMITS
    ) {
      return `spendingLimits must have 1-${MAX_SPENDING_LIMITS} entries`;
    }
    const limits: { amount: number; interval: string }[] = [];
    for (const raw of spendingLimits) {
      const amount = (raw as Record<string, unknown>)?.amount;
      const interval = (raw as Record<string, unknown>)?.interval;
      if (typeof interval !== 'string' || !VALID_SPENDING_LIMIT_INTERVALS.includes(interval as typeof VALID_SPENDING_LIMIT_INTERVALS[number])) {
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
      limits.push({ amount: cents, interval });
    }
    controls.spending_limits = limits;
  }

  return controls as unknown as string | null;
};

export const validateCreateCard = (
  payload: Record<string, unknown>,
): string | null => {
  const { subscriptionId, spendingLimit, merchantCategory } = payload;
  // The weavr provider is not wired up. Reject it explicitly rather than
  // silently creating a Stripe card — the original function answered 501.
  if (payload.provider === 'weavr') {
    return 'Provider not available';
  }
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return 'Missing required fields';
  }
  if (spendingLimit != null && (typeof spendingLimit !== 'number' || !Number.isFinite(spendingLimit) || spendingLimit < 0)) {
    return 'Spending limit must be non-negative';
  }
  if (spendingLimit != null && Math.round(spendingLimit * 100) > MAX_LIMIT_CENTS) {
    return 'Spending limit exceeds the maximum allowed';
  }
  if (merchantCategory != null && !isAllowedCategory(merchantCategory)) {
    return 'Unsupported merchant category';
  }

  const billingAddress = payload.billingAddress as Record<string, unknown> | undefined;
  if (!billingAddress) {
    return 'A valid billing address is required';
  }
  const requiredAddressFields = ['line1', 'city', 'postal_code', 'country'] as const;
  for (const field of requiredAddressFields) {
    if (typeof billingAddress[field] !== 'string' || !billingAddress[field]?.trim()) {
      return 'A valid billing address is required';
    }
  }

  return null;
};

// ── helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeStripeSearchValue = (value: string): string =>
  value.replace(/'/g, String.fromCharCode(92) + "'");

/** Insert the virtual_cards ownership row unless it already exists. */
const recordCardReference = async (
  userId: string,
  card: Pick<Stripe.Issuing.Card, 'id' | 'last4' | 'brand' | 'status'> & {
    cardholder?: string | { id: string };
  },
  subscriptionId?: string,
): Promise<boolean> => {
  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    console.error('[server/virtual-cards] Cannot record card reference: admin client not configured');
    return false;
  }
  try {
    const { data: existing } = await adminClient
      .from('virtual_cards')
      .select('card_id')
      .eq('card_id', card.id)
      .limit(1);
    if (Array.isArray(existing) && existing.length > 0) return true;

    const cardholderId =
      typeof card.cardholder === 'string' ? card.cardholder : (card.cardholder as { id: string } | undefined)?.id ?? null;

    const { error } = await adminClient.from('virtual_cards').insert({
      user_id: userId,
      card_id: card.id,
      cardholder_id: cardholderId,
      last4: card.last4,
      brand: card.brand,
      status: card.status,
      subscription_id: subscriptionId && UUID_RE.test(subscriptionId) ? subscriptionId : null,
    } as Record<string, unknown>);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      '[server/virtual-cards] Failed to record card reference:',
      (error as { message?: string })?.message ?? error,
    );
    return false;
  }
};

/** Verify that a card belongs to the given user (DB-level check). */
export const verifyCardOwnership = async (
  cardId: string,
  userId: string,
): Promise<string | null> => {
  // null = OK, non-null = error message
  const adminClient = createSupabaseAdmin();
  if (!adminClient) {
    return 'Card ownership service is not configured';
  }
  const { data } = await adminClient
    .from('virtual_cards')
    .select('card_id')
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .limit(1);
  if (Array.isArray(data) && data.length > 0) return null;
  return 'Access denied';
};

const ensureCustomer = async (
  client: Stripe,
  params: { userId: string; userEmail?: string; userName?: string; subscriptionId: string },
): Promise<Stripe.Customer> => {
  const { userId, userEmail, userName, subscriptionId } = params;
  try {
    if (userEmail) {
      const existing = await client.customers.search({
        query: `email:'${escapeStripeSearchValue(userEmail)}' OR metadata['userId']:'${escapeStripeSearchValue(userId)}'`,
        limit: 1,
      });
      if (existing.data[0]) return existing.data[0];
    }
  } catch (error) {
    console.error('Failed to search for existing Stripe customer:', error);
  }
  return client.customers.create({
    email: userEmail,
    name: userName,
    metadata: { userId, subscriptionId },
  });
};

// ── public operations ─────────────────────────────────────────────────────

export const createCard = async (
  userId: string,
  userEmail: string | undefined,
  input: CreateCardInput,
): Promise<{ ok: true; data: CreateCardOutput } | { ok: false; error: string }> => {
  try {
    const client = ensureStripe();
    const { subscriptionId, spendingLimit, merchantCategory, userName, userPhone, billingAddress } = input;

    if (!billingAddress) {
      return { ok: false, error: 'Missing billing address' };
    }
    const address = billingAddress;

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
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          country: address.country,
          postal_code: address.postal_code,
        },
      },
      metadata: { userId, subscriptionId, customerId: customer.id },
    });

    const amountCents = Math.round((spendingLimit ?? 0) * 100);
    const effectiveAmount = amountCents || 10_000;
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
        allowed_categories: merchantCategory
          ? ([merchantCategory] as CardCategory[])
          : DEFAULT_ALLOWED_CATEGORIES,
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

    await recordCardReference(userId, card, subscriptionId);

    return {
      ok: true,
      data: {
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
      },
    };
  } catch (error) {
    console.error('Virtual card creation failed:', error);
    return { ok: false, error: 'Internal server error' };
  }
};

export const listCards = async (
  userId: string,
  input: ListCardsInput,
): Promise<ListResponse> => {
  try {
    const client = ensureStripe();
    const listParams: Stripe.Issuing.CardListParams = {
      limit: Math.max(1, Math.min(input.limit ?? 10, 100)),
    };
    if (input.cardholder) listParams.cardholder = input.cardholder;
    if (input.status && ['active', 'inactive', 'canceled'].includes(input.status)) {
      listParams.status = input.status as Stripe.Issuing.Card.Status;
    }
    if (input.starting_after) listParams.starting_after = input.starting_after;

    const filteredCards: Stripe.Issuing.Card[] = [];
    let hasMoreGlobalCards = true;
    let lastScannedCardId = input.starting_after;
    let pagesScanned = 0;

    while (
      hasMoreGlobalCards &&
      filteredCards.length <= listParams.limit! &&
      pagesScanned < MAX_LIST_SCAN_PAGES
    ) {
      pagesScanned += 1;
      const cards = await client.issuing.cards.list({
        ...listParams,
        ...(lastScannedCardId ? { starting_after: lastScannedCardId } : {}),
      });

      const lastCard = cards.data[cards.data.length - 1];
      if (!lastCard || lastCard.id === lastScannedCardId) {
        hasMoreGlobalCards = false;
      } else {
        lastScannedCardId = lastCard.id;
        filteredCards.push(
          ...cards.data.filter((c) => c.metadata?.user_id === userId),
        );
        hasMoreGlobalCards = cards.has_more;
      }
    }

    const pageFull = filteredCards.length > listParams.limit!;
    const budgetExhausted = !pageFull && hasMoreGlobalCards;
    const hasMoreUserCards = pageFull || budgetExhausted;
    const pageCards = filteredCards.slice(0, listParams.limit!);
    const nextCursor = pageFull
      ? pageCards[pageCards.length - 1]?.id ?? null
      : budgetExhausted
        ? lastScannedCardId ?? null
        : null;

    const sanitized = pageCards.map((card) => ({
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
          card.spending_controls?.spending_limits?.map((l) => ({
            amount: l.amount ? l.amount / 100 : null,
            interval: l.interval,
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

    return { cards: sanitized, has_more: hasMoreUserCards, next_cursor: nextCursor };
  } catch (error) {
    console.error('Failed to list virtual cards:', error);
    return { cards: [], has_more: false, next_cursor: null, error: 'Failed to list cards' };
  }
};

export const retrieveCard = async (
  cardId: string,
  userId: string,
): Promise<
  | { ok: true; data: SanitizedCard }
  | { ok: false; error: string }
> => {
  try {
    const ownershipError = await verifyCardOwnership(cardId, userId);
    if (ownershipError) return { ok: false, error: ownershipError };

    const client = ensureStripe();
    const card = await client.issuing.cards.retrieve(cardId);

    if (card.metadata?.user_id !== userId) {
      return { ok: false, error: 'Access denied' };
    }

    return {
      ok: true,
      data: {
        id: card.id,
        status: card.status,
        type: card.type,
        brand: card.brand,
        last4: card.last4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        cardholder: card.cardholder,
        spending_controls: card.spending_controls as unknown as Record<string, unknown>,
        created: card.created,
        metadata: card.metadata as Record<string, unknown>,
        currency: card.currency,
      },
    };
  } catch (error) {
    console.error('Failed to retrieve virtual card:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return { ok: false, error: `Stripe error: ${error.message}` };
    }
    return { ok: false, error: 'Failed to retrieve card details' };
  }
};

export const updateCard = async (
  cardId: string,
  userId: string,
  updates: UpdateCardInput,
): Promise<
  | { ok: true; data: UpdateCardOutput }
  | { ok: false; error: string; status?: number }
> => {
  try {
    // An ownership failure is a 403, not a 400: the request was well formed
    // but the card belongs to someone else.
    const ownershipError = await verifyCardOwnership(cardId, userId);
    if (ownershipError) return { ok: false, error: ownershipError, status: 403 };

    const controls = parseUpdateControls(updates);
    if (typeof controls === 'string') return { ok: false, error: controls };
    if (updates.status !== undefined && !['active', 'inactive', 'canceled'].includes(updates.status)) {
      return { ok: false, error: 'Unsupported status' };
    }
    if (controls === null && updates.status === undefined) {
      return { ok: false, error: 'Nothing to update' };
    }

    const client = ensureStripe();
    const existing = await client.issuing.cards.retrieve(cardId);
    if (existing.metadata?.user_id !== userId) {
      return { ok: false, error: 'Access denied', status: 403 };
    }

    const updateParams: Stripe.Issuing.CardUpdateParams = {};
    if (updates.status !== undefined) {
      updateParams.status = updates.status as Stripe.Issuing.CardUpdateParams.Status;
    }
    if (controls !== null) {
      updateParams.spending_controls = controls as Stripe.Issuing.CardUpdateParams.SpendingControls;
    }

    const updatedCard = await client.issuing.cards.update(cardId, updateParams);

    return {
      ok: true,
      data: {
        success: true,
        card: {
          id: updatedCard.id,
          status: updatedCard.status,
          spending_controls: updatedCard.spending_controls as unknown as Record<string, unknown>,
          last4: updatedCard.last4,
          metadata: updatedCard.metadata as Record<string, unknown>,
          updated: Date.now(),
        },
        message: 'Card updated successfully',
      },
    };
  } catch (error) {
    console.error('Failed to update virtual card:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return { ok: false, error: `Stripe error: ${error.message}` };
    }
    return { ok: false, error: 'Failed to update card' };
  }
};

// ── S304: secure reveal and transactions ───────────────────────────────────

/**
 * Stripe Issuing Elements nonces look like `ephkn_pub_...`, and the Stripe
 * version is the client library's dated API version. Both are checked before
 * any Stripe call so a malformed request cannot reach the API.
 */
const NONCE_RE = /^ephkn_[A-Za-z0-9_]{8,200}$/;
const STRIPE_VERSION_RE = /^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/;

export interface EphemeralKeyInput {
  nonce: unknown;
  stripeVersion: unknown;
}

export interface EphemeralKeyOutput {
  /** Short-lived secret that lets Issuing Elements show this one card. */
  secret: string;
  /** Unix seconds. */
  expires: number;
}

/**
 * Create an ephemeral key for exactly one card the caller owns. The browser
 * hands it to Stripe Issuing Elements, which fetch and draw the number and
 * CVC inside Stripe's own iframe: the full card details never pass through
 * this server, the API response or app state.
 */
export const createCardEphemeralKey = async (
  cardId: string,
  userId: string,
  input: EphemeralKeyInput,
): Promise<{ ok: true; data: EphemeralKeyOutput } | { ok: false; error: string; status: number }> => {
  if (typeof input.nonce !== 'string' || !NONCE_RE.test(input.nonce)) {
    return { ok: false, error: 'Invalid nonce', status: 400 };
  }
  if (typeof input.stripeVersion !== 'string' || !STRIPE_VERSION_RE.test(input.stripeVersion)) {
    return { ok: false, error: 'Invalid Stripe version', status: 400 };
  }

  const ownershipError = await verifyCardOwnership(cardId, userId);
  if (ownershipError) return { ok: false, error: ownershipError, status: 403 };

  try {
    const client = ensureStripe();
    const card = await client.issuing.cards.retrieve(cardId);
    if (card.metadata?.user_id !== userId) {
      return { ok: false, error: 'Access denied', status: 403 };
    }

    const key = await client.ephemeralKeys.create(
      { issuing_card: cardId, nonce: input.nonce },
      { apiVersion: input.stripeVersion },
    );
    if (!key.secret) return { ok: false, error: 'Could not create a reveal key', status: 502 };

    return { ok: true, data: { secret: key.secret, expires: key.expires } };
  } catch (error) {
    console.error(
      '[server/virtual-cards] Ephemeral key failed:',
      (error as { message?: string })?.message ?? 'unknown error',
    );
    return { ok: false, error: 'Could not create a reveal key', status: 502 };
  }
};

export interface CardTransaction {
  id: string;
  /** Minor units (cents), as Stripe reports them. */
  amount: number;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  approved: boolean;
  date: string;
  livemode: boolean;
}

/** Authorizations recorded by the webhook for one card the caller owns. */
export const listCardTransactions = async (
  cardId: string,
  userId: string,
  limit = 20,
): Promise<{ ok: true; data: CardTransaction[] } | { ok: false; error: string; status: number }> => {
  const ownershipError = await verifyCardOwnership(cardId, userId);
  if (ownershipError) return { ok: false, error: ownershipError, status: 403 };

  const adminClient = createSupabaseAdmin();
  if (!adminClient) return { ok: false, error: 'Transactions service is not configured', status: 503 };

  const { data, error } = await adminClient
    .from('card_authorizations')
    .select('id, amount, currency, merchant_name, merchant_category, approved, transaction_date, livemode')
    .eq('stripe_card_id', cardId)
    .order('transaction_date', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) {
    console.error('[server/virtual-cards] Transactions read failed:', error.message);
    return { ok: false, error: 'Failed to load transactions', status: 500 };
  }

  type Row = {
    id: string;
    amount: number | string | null;
    currency: string | null;
    merchant_name: string | null;
    merchant_category: string | null;
    approved: boolean | null;
    transaction_date: string | null;
    livemode: boolean | null;
  };

  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      amount: Number(r.amount ?? 0),
      currency: (r.currency ?? 'usd').toLowerCase(),
      merchantName: r.merchant_name,
      merchantCategory: r.merchant_category,
      approved: r.approved === true,
      date: r.transaction_date ?? '',
      livemode: r.livemode !== false,
    })),
  };
};
