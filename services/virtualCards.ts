import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { buildApiBases, buildUrl, requestWithFallback } from '@/lib/apiClient';

/**
 * Client for /api/embedded-finance/virtual-cards.
 *
 * Card data rules (S304):
 * - Responses carry last4, brand, status and expiry only.
 * - The full number and CVC are never requested from our API. On web they are
 *   drawn by Stripe Issuing Elements, which fetch them from Stripe directly
 *   with a short-lived key for one card (`createRevealKey`).
 */

export interface VirtualCardSummary {
  id: string;
  last4: string;
  brand: string;
  status: 'active' | 'inactive' | 'canceled' | string;
  expMonth?: number;
  expYear?: number;
  currency?: string;
  subscriptionId?: string;
}

export interface VirtualCardTransaction {
  id: string;
  /** Minor units (cents). */
  amount: number;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  approved: boolean;
  date: string;
  livemode: boolean;
}

export interface RevealKey {
  secret: string;
  expires: number;
}

type RawCard = {
  id?: unknown;
  last4?: unknown;
  brand?: unknown;
  status?: unknown;
  exp_month?: unknown;
  exp_year?: unknown;
  currency?: unknown;
  metadata?: { subscription_id?: unknown } | null;
};

/** Keep only display-safe fields, whatever the server sends. */
export function toCardSummary(raw: RawCard): VirtualCardSummary | null {
  if (typeof raw?.id !== 'string' || typeof raw.last4 !== 'string') return null;
  return {
    id: raw.id,
    last4: raw.last4,
    brand: typeof raw.brand === 'string' ? raw.brand : 'Card',
    status: typeof raw.status === 'string' ? raw.status : 'inactive',
    expMonth: typeof raw.exp_month === 'number' ? raw.exp_month : undefined,
    expYear: typeof raw.exp_year === 'number' ? raw.exp_year : undefined,
    currency: typeof raw.currency === 'string' ? raw.currency : undefined,
    subscriptionId:
      typeof raw.metadata?.subscription_id === 'string' ? raw.metadata.subscription_id : undefined,
  };
}

const MAX_LIST_REQUESTS = 10;

class VirtualCardService {
  private readonly apiBases: string[];

  constructor() {
    this.apiBases = buildApiBases(
      [
        process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL,
        process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_FALLBACK_URL,
        process.env.EXPO_PUBLIC_API_BASE_URL,
        process.env.EXPO_PUBLIC_API_FALLBACK_URL,
      ],
      { includeRelative: false },
    );
  }

  /** The signed-in user's access token; the API rejects calls without it. */
  private async authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const allowRelative = Platform.OS === 'web' && typeof window !== 'undefined';
    const headers = {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
      ...(await this.authHeaders()),
    };
    return requestWithFallback<T>(
      path,
      { ...init, headers },
      {
        bases: this.apiBases,
        urls: allowRelative ? [buildUrl('/api', path)] : [],
        allowRelative,
        // A 4xx is the API's answer (bad input, not yours, signed out); do not
        // retry it against another base.
        tryNextOnStatus: (status) => status >= 500,
      },
    );
  }

  /**
   * All of the user's cards. The server scans the shared Stripe account a few
   * pages at a time and can return an empty page with a cursor, so follow
   * `next_cursor` while `has_more` is set. `complete` is false only if the
   * request budget ran out first, so the screen never presents a partial list
   * as the whole list.
   */
  async listCards(): Promise<{ cards: VirtualCardSummary[]; complete: boolean }> {
    const cards: VirtualCardSummary[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_LIST_REQUESTS; i += 1) {
      const query: string = cursor
        ? `?limit=100&starting_after=${encodeURIComponent(cursor)}`
        : '?limit=100';
      const page: { cards?: RawCard[]; has_more?: boolean; next_cursor?: string | null } =
        await this.request(`/embedded-finance/virtual-cards/list${query}`);
      for (const raw of page.cards ?? []) {
        const card = toCardSummary(raw);
        if (card) cards.push(card);
      }
      if (!page.has_more || !page.next_cursor || page.next_cursor === cursor) {
        return { cards, complete: true };
      }
      cursor = page.next_cursor;
    }
    return { cards, complete: false };
  }

  /** Freeze (inactive) or unfreeze (active) a card the user owns. */
  async setCardLocked(cardId: string, locked: boolean): Promise<void> {
    await this.request(`/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/update`, {
      method: 'PATCH',
      body: JSON.stringify({ status: locked ? 'inactive' : 'active' }),
    });
  }

  async getCardTransactions(cardId: string, limit = 20): Promise<VirtualCardTransaction[]> {
    const payload = await this.request<{ transactions?: VirtualCardTransaction[] }>(
      `/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/transactions?limit=${limit}`,
    );
    return payload.transactions ?? [];
  }

  /**
   * Short-lived key that lets Stripe Issuing Elements show one card. The
   * nonce comes from `stripe.createEphemeralKeyNonce`, so the key can only be
   * used by the Stripe.js instance that asked for it.
   */
  async createRevealKey(cardId: string, nonce: string, stripeVersion: string): Promise<RevealKey> {
    return this.request<RevealKey>(
      `/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/ephemeral-key`,
      { method: 'POST', body: JSON.stringify({ nonce, stripeVersion }) },
    );
  }
}

export const virtualCardService = new VirtualCardService();
