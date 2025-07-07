export interface VirtualCard {
  id: string;
  subscriptionId: string;
  userId: string;
  cardNumber: string; // Encrypted/tokenized
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string; // Encrypted
  status: 'active' | 'blocked' | 'expired' | 'canceled';
  spendingLimit: number;
  merchantCategory?: string;
  createdAt: Date;
  updatedAt: Date;
  provider: 'stripe' | 'weavr';
  providerCardId: string;
  nickname?: string;
  totalSpent?: number;
}

export interface VirtualCardTransaction {
  id: string;
  cardId: string;
  amount: number;
  merchantName: string;
  date: string;
  type: 'payment' | 'refund' | 'authorization';
  status: 'completed' | 'pending' | 'failed';
  category?: string;
}

export interface CancellationRequest {
  id: string;
  subscriptionId: string;
  userId: string;
  vendorUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  automationType: 'bot' | 'api' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateLink {
  id: string;
  subscriptionId: string;
  originalUrl: string;
  affiliateUrl: string;
  commission: number;
  provider: string;
  isActive: boolean;
  clickCount: number;
  conversionCount: number;
  lastClickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddedFinanceConfig {
  virtualCards: {
    enabled: boolean;
    provider: 'stripe' | 'weavr';
    defaultSpendingLimit: number;
    autoCreateForSubscriptions: boolean;
  };
  creditService: {
    enabled: boolean;
    provider: 'subtrack_credit' | 'external';
    defaultCreditLimit: number;
    autoPayForSubscriptions: boolean;
    settlementPeriod: 'weekly' | 'monthly' | 'quarterly';
  };
  automation: {
    enabled: boolean;
    maxAttempts: number;
    retryDelayMinutes: number;
    supportedVendors: string[];
  };
  paymentOptimization: {
    enabled: boolean;
    provider: 'subtrack_optimizer' | 'external';
    autoSwitchCards: boolean;
    preventFailures: boolean;
  };
  affiliates: {
    enabled: boolean;
    trackingEnabled: boolean;
    defaultCommission: number;
  };
}