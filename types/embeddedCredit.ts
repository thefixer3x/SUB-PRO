export interface EmbeddedCreditAccount {
  id: string;
  userId: string;
  status: 'active' | 'suspended' | 'pending_approval' | 'closed';
  creditLimit: number;
  availableCredit: number;
  currentBalance: number;
  nextSettlementDate: string;
  monthlySettlementDay: number; // 1-31
  autoPayEnabled: boolean;
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddedCreditTransaction {
  id: string;
  accountId: string;
  subscriptionId: string;
  amount: number;
  description: string;
  vendorName: string;
  transactionDate: string;
  type: 'subscription_payment' | 'settlement' | 'fee' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  settlementId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: Date;
}

export interface MonthlySettlement {
  id: string;
  accountId: string;
  userId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalAmount: number;
  transactionCount: number;
  status: 'pending' | 'processed' | 'failed' | 'overdue';
  dueDate: string;
  processedDate?: string;
  paymentMethodId?: string;
  failureReason?: string;
  transactions: EmbeddedCreditTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddedCreditSubscription {
  id: string;
  subscriptionId: string;
  accountId: string;
  status: 'active' | 'paused' | 'cancelled';
  monthlyAmount: number;
  nextPaymentDate: string;
  vendorName: string;
  vendorAccountDetails?: {
    email?: string;
    username?: string;
    accountId?: string;
  };
  autopayEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddedCreditConfig {
  defaultCreditLimit: number;
  maxCreditLimit: number;
  settlementDay: number; // Default day of month for settlements
  gracePeriodDays: number;
  lateFeeAmount: number;
  interestRate: number; // Annual percentage rate for overdue balances
  eligibilityChecks: {
    minimumCreditScore?: number;
    minimumIncome?: number;
    maximumDebtToIncome?: number;
  };
}
