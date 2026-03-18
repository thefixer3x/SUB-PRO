import { VirtualCard, VirtualCardTransaction } from '@/types/embeddedFinance';
import { EMBEDDED_FINANCE_CONFIG, ENCRYPTION_CONFIG } from '@/config/embeddedFinance';

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
    const response = await fetch('/api/embedded-finance/virtual-cards/create', {
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

    if (!response.ok) {
      throw new Error('Failed to create Stripe Issuing card');
    }

    return await response.json();
  }

  private async createWeavrCard(params: CreateVirtualCardParams): Promise<VirtualCard> {
    const response = await fetch('/api/embedded-finance/virtual-cards/create', {
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

    if (!response.ok) {
      throw new Error('Failed to create Weavr card');
    }

    return await response.json();
  }

  async getVirtualCard(cardId: string): Promise<VirtualCard> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/${cardId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch virtual card');
    }

    return await response.json();
  }

  async updateVirtualCard(params: UpdateVirtualCardParams): Promise<VirtualCard> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/${params.cardId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spendingLimit: params.spendingLimit,
        status: params.status,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update virtual card');
    }

    return await response.json();
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
    const response = await fetch(`/api/embedded-finance/virtual-cards/user/${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user virtual cards');
    }

    return await response.json();
  }

  async getCardsBySubscription(subscriptionId: string): Promise<VirtualCard[]> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/subscription/${subscriptionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch subscription virtual cards');
    }

    return await response.json();
  }

  // Secure card data retrieval (for display purposes)
  async getCardDetails(cardId: string): Promise<{ last4: string; expiryMonth: number; expiryYear: number }> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/${cardId}/details`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch card details');
    }

    return await response.json();
  }

  // Get transactions for a specific card
  async getCardTransactions(cardId: string): Promise<VirtualCardTransaction[]> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/${cardId}/transactions`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch card transactions');
    }

    return await response.json();
  }

  // Temporary card reveal (for one-time use)
  async revealCardDetails(cardId: string, purpose: 'payment' | 'update'): Promise<{
    cardNumber: string;
    cvv: string;
    expiryMonth: number;
    expiryYear: number;
  }> {
    const response = await fetch(`/api/embedded-finance/virtual-cards/${cardId}/reveal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purpose }),
    });

    if (!response.ok) {
      throw new Error('Failed to reveal card details');
    }

    return await response.json();
  }
}

export const virtualCardService = new VirtualCardService();