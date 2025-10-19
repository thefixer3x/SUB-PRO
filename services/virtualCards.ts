import { Platform } from 'react-native';
import { VirtualCard, VirtualCardTransaction } from '@/types/embeddedFinance';
import { EMBEDDED_FINANCE_CONFIG } from '@/config/embeddedFinance';
import { buildApiBases, buildUrl, requestWithFallback } from '@/lib/apiClient';

export interface CreateVirtualCardParams {
  subscriptionId: string;
  userId: string;
  spendingLimit?: number;
  merchantCategory?: string;
  nickname?: string;
}

export interface UpdateVirtualCardParams {
  cardId: string;
  spendingLimit?: number;
  status?: 'active' | 'blocked';
}

class VirtualCardService {
  private config = EMBEDDED_FINANCE_CONFIG.virtualCards;
  private readonly apiBases: string[];

  constructor() {
    this.apiBases = buildApiBases(
      [
        process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL,
        process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_FALLBACK_URL,
        process.env.EXPO_PUBLIC_API_BASE_URL,
        process.env.EXPO_PUBLIC_API_FALLBACK_URL,
      ],
      { includeRelative: false }
    );
  }

  private shouldAllowRelative() {
    return Platform.OS === 'web' && typeof window !== 'undefined';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const allowRelative = this.shouldAllowRelative();
    const directUrls = allowRelative ? [buildUrl('/api', path)] : [];

    return requestWithFallback<T>(path, init, {
      bases: this.apiBases,
      urls: directUrls,
      allowRelative,
    });
  }

  async createVirtualCard(params: CreateVirtualCardParams): Promise<VirtualCard> {
    try {
      if (this.config.provider === 'stripe') {
        return await this.createStripeIssuingCard(params);
      } else {
        return await this.createWeavrCard(params);
      }
    } catch (error) {
      console.error('Failed to create virtual card:', error);
      throw new Error('Virtual card creation failed');
    }
  }

  private async createStripeIssuingCard(params: CreateVirtualCardParams): Promise<VirtualCard> {
    return this.request<VirtualCard>('/embedded-finance/virtual-cards/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'stripe',
        subscriptionId: params.subscriptionId,
        userId: params.userId,
        spendingLimit: params.spendingLimit || this.config.defaultSpendingLimit,
        merchantCategory: params.merchantCategory,
      }),
    });
  }

  private async createWeavrCard(params: CreateVirtualCardParams): Promise<VirtualCard> {
    return this.request<VirtualCard>('/embedded-finance/virtual-cards/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'weavr',
        subscriptionId: params.subscriptionId,
        userId: params.userId,
        spendingLimit: params.spendingLimit || this.config.defaultSpendingLimit,
        merchantCategory: params.merchantCategory,
      }),
    });
  }

  async getVirtualCard(cardId: string): Promise<VirtualCard> {
    return this.request<VirtualCard>(`/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}`);
  }

  async updateVirtualCard(params: UpdateVirtualCardParams): Promise<VirtualCard> {
    return this.request<VirtualCard>(`/embedded-finance/virtual-cards/${encodeURIComponent(params.cardId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spendingLimit: params.spendingLimit,
        status: params.status,
      }),
    });
  }

  async blockVirtualCard(cardId: string): Promise<void> {
    await this.updateVirtualCard({
      cardId,
      status: 'blocked',
    });
  }

  async unblockVirtualCard(cardId: string): Promise<void> {
    await this.updateVirtualCard({
      cardId,
      status: 'active',
    });
  }

  async getCardsByUser(userId: string): Promise<VirtualCard[]> {
    return this.request<VirtualCard[]>(
      `/embedded-finance/virtual-cards/user/${encodeURIComponent(userId)}`
    );
  }

  async getCardsBySubscription(subscriptionId: string): Promise<VirtualCard[]> {
    return this.request<VirtualCard[]>(
      `/embedded-finance/virtual-cards/subscription/${encodeURIComponent(subscriptionId)}`
    );
  }

  // Secure card data retrieval (for display purposes)
  async getCardDetails(cardId: string): Promise<{ last4: string; expiryMonth: number; expiryYear: number }> {
    return this.request<{ last4: string; expiryMonth: number; expiryYear: number }>(
      `/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/details`
    );
  }

  // Get transactions for a specific card
  async getCardTransactions(cardId: string): Promise<VirtualCardTransaction[]> {
    return this.request<VirtualCardTransaction[]>(
      `/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/transactions`
    );
  }

  // Temporary card reveal (for one-time use)
  async revealCardDetails(cardId: string, purpose: 'payment' | 'update'): Promise<{
    cardNumber: string;
    cvv: string;
    expiryMonth: number;
    expiryYear: number;
  }> {
    return this.request<{
      cardNumber: string;
      cvv: string;
      expiryMonth: number;
      expiryYear: number;
    }>(`/embedded-finance/virtual-cards/${encodeURIComponent(cardId)}/reveal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purpose }),
    });
  }
}

export const virtualCardService = new VirtualCardService();