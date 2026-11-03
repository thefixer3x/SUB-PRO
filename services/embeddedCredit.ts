import { 
  EmbeddedCreditAccount, 
  EmbeddedCreditTransaction, 
  MonthlySettlement,
  EmbeddedCreditSubscription,
  EmbeddedCreditConfig
} from '@/types/embeddedCredit';
import { FEATURE_FLAGS } from '@/config/featureFlags';

/**
 * Thrown when a caller reaches for embedded credit while the feature is off.
 *
 * Embedded credit has no provider behind it yet: every value this service
 * returns is simulated. Failing loudly keeps a simulated approval from ever
 * reaching a screen (see issue #39).
 */
export class EmbeddedCreditDisabledError extends Error {
  constructor(operation: string) {
    super(`Embedded credit is disabled: "${operation}" is unavailable.`);
    this.name = 'EmbeddedCreditDisabledError';
  }
}

/**
 * Whether the embedded credit feature is enabled.
 *
 * Reads the static flag from `config/featureFlags.ts` on purpose and not the
 * DB-backed `sm_feature_flags` table: a row flip in the database must never be
 * able to put a simulated credit approval in front of a user. The flag ships
 * off (`CREDIT_SERVICE: false`) and the development overrides in that file do
 * not turn it on.
 */
export function isEmbeddedCreditEnabled(): boolean {
  return FEATURE_FLAGS.CREDIT_SERVICE === true;
}

class EmbeddedCreditService {
  private config: EmbeddedCreditConfig = {
    defaultCreditLimit: 5000,
    maxCreditLimit: 25000,
    settlementDay: 15, // 15th of each month
    gracePeriodDays: 5,
    lateFeeAmount: 25,
    interestRate: 0.1299, // 12.99% APR
    eligibilityChecks: {
      minimumCreditScore: 650,
      minimumIncome: 30000,
      maximumDebtToIncome: 0.4,
    },
  };

  /**
   * Single choke point for the feature flag.
   *
   * Every method below returns simulated data (fake limits, fake settlements,
   * fake approvals). While the flag is off they must not hand any of it out,
   * so each one calls this first and throws instead.
   */
  private assertEnabled(operation: string): void {
    if (!isEmbeddedCreditEnabled()) {
      throw new EmbeddedCreditDisabledError(operation);
    }
  }

  async getCreditAccount(userId: string): Promise<EmbeddedCreditAccount | null> {
    this.assertEnabled('getCreditAccount');
    // TODO: Replace with actual API call
    return {
      id: `credit_${userId}`,
      userId,
      status: 'active',
      creditLimit: 5000,
      availableCredit: 3250,
      currentBalance: 1750,
      nextSettlementDate: '2024-03-15',
      monthlySettlementDay: 15,
      autoPayEnabled: true,
      paymentMethodId: 'pm_example123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };
  }

  async createCreditAccount(userId: string, creditLimit?: number): Promise<EmbeddedCreditAccount> {
    this.assertEnabled('createCreditAccount');
    // TODO: Replace with actual API call to create credit account
    // This would involve credit checks, KYC verification, etc.
    const account: EmbeddedCreditAccount = {
      id: `credit_${userId}_${Date.now()}`,
      userId,
      status: 'pending_approval',
      creditLimit: creditLimit || this.config.defaultCreditLimit,
      availableCredit: creditLimit || this.config.defaultCreditLimit,
      currentBalance: 0,
      nextSettlementDate: this.calculateNextSettlementDate(),
      monthlySettlementDay: this.config.settlementDay,
      autoPayEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return account;
  }

  async enableSubscriptionCredit(
    accountId: string,
    subscriptionId: string,
    monthlyAmount: number,
    vendorName: string
  ): Promise<EmbeddedCreditSubscription> {
    this.assertEnabled('enableSubscriptionCredit');
    // TODO: Replace with actual API call
    const creditSubscription: EmbeddedCreditSubscription = {
      id: `credit_sub_${Date.now()}`,
      subscriptionId,
      accountId,
      status: 'active',
      monthlyAmount,
      nextPaymentDate: this.calculateNextPaymentDate(),
      vendorName,
      autopayEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return creditSubscription;
  }

  async processSubscriptionPayment(
    accountId: string,
    subscriptionId: string,
    amount: number,
    vendorName: string
  ): Promise<EmbeddedCreditTransaction> {
    this.assertEnabled('processSubscriptionPayment');
    // TODO: Replace with actual payment processing
    const transaction: EmbeddedCreditTransaction = {
      id: `txn_${Date.now()}`,
      accountId,
      subscriptionId,
      amount,
      description: `${vendorName} subscription payment`,
      vendorName,
      transactionDate: new Date().toISOString(),
      type: 'subscription_payment',
      status: 'completed',
      createdAt: new Date(),
    };

    return transaction;
  }

  async getMonthlySettlement(accountId: string, month?: string): Promise<MonthlySettlement | null> {
    this.assertEnabled('getMonthlySettlement');
    // TODO: Replace with actual API call
    // Mock current month settlement
    const now = new Date();
    const currentMonth = month || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    return {
      id: `settlement_${accountId}_${currentMonth}`,
      accountId,
      userId: 'current-user-id',
      billingPeriodStart: `${currentMonth}-01`,
      billingPeriodEnd: `${currentMonth}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
      totalAmount: 1750,
      transactionCount: 8,
      status: 'pending',
      dueDate: `${currentMonth}-15`,
      transactions: [],
      createdAt: new Date(`${currentMonth}-01`),
      updatedAt: new Date(),
    };
  }

  async getTransactionHistory(
    accountId: string,
    limit = 50,
    offset = 0
  ): Promise<EmbeddedCreditTransaction[]> {
    this.assertEnabled('getTransactionHistory');
    // TODO: Replace with actual API call
    // Mock transaction history
    const mockTransactions: EmbeddedCreditTransaction[] = [
      {
        id: 'txn_1',
        accountId,
        subscriptionId: '1',
        amount: 15.99,
        description: 'Netflix Premium subscription',
        vendorName: 'Netflix',
        transactionDate: '2024-02-15T10:00:00Z',
        type: 'subscription_payment',
        status: 'completed',
        createdAt: new Date('2024-02-15'),
      },
      {
        id: 'txn_2',
        accountId,
        subscriptionId: '2',
        amount: 9.99,
        description: 'Spotify Premium subscription',
        vendorName: 'Spotify',
        transactionDate: '2024-02-20T10:00:00Z',
        type: 'subscription_payment',
        status: 'completed',
        createdAt: new Date('2024-02-20'),
      },
      {
        id: 'txn_3',
        accountId,
        subscriptionId: '3',
        amount: 9.99,
        description: 'Adobe Creative subscription',
        vendorName: 'Adobe',
        transactionDate: '2024-02-18T10:00:00Z',
        type: 'subscription_payment',
        status: 'completed',
        createdAt: new Date('2024-02-18'),
      },
    ];

    return mockTransactions.slice(offset, offset + limit);
  }

  async toggleAutoPay(accountId: string, enabled: boolean): Promise<void> {
    this.assertEnabled('toggleAutoPay');
    // TODO: Replace with actual API call
    console.log(`Auto-pay ${enabled ? 'enabled' : 'disabled'} for account ${accountId}`);
  }

  async updatePaymentMethod(accountId: string, paymentMethodId: string): Promise<void> {
    this.assertEnabled('updatePaymentMethod');
    // TODO: Replace with actual API call
    console.log(`Payment method updated for account ${accountId}: ${paymentMethodId}`);
  }

  async checkEligibility(userId: string): Promise<{
    eligible: boolean;
    reasons?: string[];
    suggestedCreditLimit?: number;
  }> {
    this.assertEnabled('checkEligibility');
    // TODO: Replace with actual credit check API
    // Mock eligibility check
    return {
      eligible: true,
      suggestedCreditLimit: 5000,
    };
  }

  private calculateNextSettlementDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, this.config.settlementDay);
    return nextMonth.toISOString().split('T')[0];
  }

  private calculateNextPaymentDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return nextMonth.toISOString().split('T')[0];
  }

  getConfig(): EmbeddedCreditConfig {
    this.assertEnabled('getConfig');
    return { ...this.config };
  }
}

export const embeddedCreditService = new EmbeddedCreditService();
