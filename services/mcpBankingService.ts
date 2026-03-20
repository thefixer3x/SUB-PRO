import { supabase } from '@/lib/supabase';

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  balance: number;
  currency: string;
  isConnected: boolean;
  lastSync: string;
}

interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  description: string;
  merchant: string;
  category: string;
  date: string;
  isRecurring: boolean;
  subscriptionId?: string;
}

interface SubscriptionDetection {
  merchant: string;
  amount: number;
  frequency: 'monthly' | 'yearly' | 'weekly';
  confidence: number;
  category: string;
  nextBilling: string;
  transactions: Transaction[];
}

interface MCPBankingConfig {
  apiKey: string;
  baseUrl: string;
  webhookUrl?: string;
}

export class MCPBankingService {
  private config: MCPBankingConfig;
  private userId: string;

  constructor(config: MCPBankingConfig, userId: string) {
    this.config = config;
    this.userId = userId;
  }

  /**
   * Connect to a bank account using Open Banking API
   */
  async connectBankAccount(bankCode: string, credentials: any): Promise<BankAccount> {
    try {
      const response = await fetch(`${this.config.baseUrl}/banking/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          bankCode,
          credentials,
          webhookUrl: this.config.webhookUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect bank account: ${response.statusText}`);
      }

      const bankAccount = await response.json();

      // Store in Supabase
      await supabase
        .from('bank_accounts')
        .insert({
          id: bankAccount.id,
          user_id: this.userId,
          bank_name: bankAccount.bankName,
          account_type: bankAccount.accountType,
          account_number: bankAccount.accountNumber,
          balance: bankAccount.balance,
          currency: bankAccount.currency,
          is_connected: true,
          last_sync: new Date().toISOString(),
        });

      return bankAccount;
    } catch (error) {
      console.error('Error connecting bank account:', error);
      throw error;
    }
  }

  /**
   * Fetch transactions from connected bank accounts
   */
  async fetchTransactions(accountId: string, fromDate?: string, toDate?: string): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams({
        accountId,
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
      });

      const response = await fetch(`${this.config.baseUrl}/banking/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const transactions = await response.json();

      // Store transactions in Supabase
      for (const transaction of transactions) {
        await supabase
          .from('transactions')
          .upsert({
            id: transaction.id,
            user_id: this.userId,
            account_id: transaction.accountId,
            amount: transaction.amount,
            currency: transaction.currency,
            description: transaction.description,
            merchant: transaction.merchant,
            category: transaction.category,
            date: transaction.date,
            is_recurring: transaction.isRecurring,
            subscription_id: transaction.subscriptionId,
          });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Analyze transactions to detect subscriptions using AI
   */
  async detectSubscriptions(accountId: string): Promise<SubscriptionDetection[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/ai/detect-subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          accountId,
          analysisDepth: 'deep', // Use AI for pattern recognition
          lookbackMonths: 12,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to detect subscriptions: ${response.statusText}`);
      }

      const detections = await response.json();

      // Store detected subscriptions
      for (const detection of detections) {
        await supabase
          .from('detected_subscriptions')
          .upsert({
            user_id: this.userId,
            merchant: detection.merchant,
            amount: detection.amount,
            frequency: detection.frequency,
            confidence: detection.confidence,
            category: detection.category,
            next_billing: detection.nextBilling,
            is_confirmed: false,
            created_at: new Date().toISOString(),
          });
      }

      return detections;
    } catch (error) {
      console.error('Error detecting subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get AI-powered spending insights
   */
  async getSpendingInsights(accountId: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/ai/spending-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          accountId,
          analysisType: 'comprehensive',
          includeRecommendations: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get spending insights: ${response.statusText}`);
      }

      const insights = await response.json();

      // Store insights
      await supabase
        .from('spending_insights')
        .insert({
          user_id: this.userId,
          account_id: accountId,
          insights: insights,
          generated_at: new Date().toISOString(),
        });

      return insights;
    } catch (error) {
      console.error('Error getting spending insights:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription through the service provider
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({
          subscriptionId,
          reason,
          requestCancellation: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel subscription: ${response.statusText}`);
      }

      const result = await response.json();

      // Update subscription status
      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq('id', subscriptionId)
        .eq('user_id', this.userId);

      return result.success;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get connected bank accounts
   */
  async getConnectedAccounts(): Promise<BankAccount[]> {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_connected', true);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting connected accounts:', error);
      throw error;
    }
  }

  /**
   * Sync account data
   */
  async syncAccount(accountId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/banking/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync account: ${response.statusText}`);
      }

      // Update last sync time
      await supabase
        .from('bank_accounts')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', accountId)
        .eq('user_id', this.userId);

    } catch (error) {
      console.error('Error syncing account:', error);
      throw error;
    }
  }

  /**
   * Disconnect a bank account
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/banking/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-User-ID': this.userId,
        },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect account: ${response.statusText}`);
      }

      // Update connection status
      await supabase
        .from('bank_accounts')
        .update({ is_connected: false })
        .eq('id', accountId)
        .eq('user_id', this.userId);

    } catch (error) {
      console.error('Error disconnecting account:', error);
      throw error;
    }
  }
}

// Factory function to create MCP Banking Service
export const createMCPBankingService = (userId: string): MCPBankingService => {
  const config: MCPBankingConfig = {
    apiKey: process.env.EXPO_PUBLIC_MCP_API_KEY || '',
    baseUrl: process.env.EXPO_PUBLIC_MCP_BASE_URL || 'https://api.onasis-gateway.com',
    webhookUrl: process.env.EXPO_PUBLIC_WEBHOOK_URL,
  };

  return new MCPBankingService(config, userId);
};

// Export types
export type {
  BankAccount,
  Transaction,
  SubscriptionDetection,
  MCPBankingConfig,
};
