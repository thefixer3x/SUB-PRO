import { supabase, isSupabaseEnvConfigured } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber?: string;
  balance: number;
  currency: string;
  isConnected: boolean;
  lastSync: string;
}

export interface Transaction {
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

export interface SubscriptionDetection {
  merchant: string;
  amount: number;
  frequency: 'monthly' | 'yearly' | 'weekly';
  confidence: number;
  category: string;
  nextBilling: string;
  transactions: Transaction[];
}

interface MCPBankingConfig {
  /** Base URL of our own server-side proxy (NOT the external API). */
  proxyBaseUrl: string;
}

type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

const SUBSCRIPTIONS_TABLE: keyof Database['public']['Tables'] = 'subscriptions';

/**
 * Client-side banking service.
 *
 * All external MCP/Onasis API calls are routed through
 * `app/api/banking/proxy+api.ts` so the bearer token never
 * reaches the client bundle.
 */
export class MCPBankingService {
  private config: MCPBankingConfig;
  private userId: string;

  constructor(config: MCPBankingConfig, userId: string) {
    this.config = config;
    this.userId = userId;
  }

  // ── helpers ────────────────────────────────────────────────

  /** Call the server-side proxy which forwards to the MCP API. */
  private async proxyFetch<T = unknown>(
    path: string,
    payload?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error('You must be signed in to use banking services.');
    }

    const res = await fetch(`${this.config.proxyBaseUrl}/api/banking/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ path, payload, method }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as Record<string, string>).error ??
          `Banking proxy error (${res.status})`,
      );
    }

    return res.json() as Promise<T>;
  }

  /** Throw if a Supabase write fails instead of swallowing the error. */
  private assertSupabaseWrite(
    result: { error: { message: string } | null },
    context: string,
  ) {
    if (result.error) {
      throw new Error(`Supabase ${context}: ${result.error.message}`);
    }
  }

  // ── public API ─────────────────────────────────────────────

  async connectBankAccount(
    bankCode: string,
    credentials: Record<string, unknown>,
  ): Promise<BankAccount> {
    const bankAccount = await this.proxyFetch<BankAccount>(
      '/banking/connect',
      { bankCode, credentials },
    );

    if (isSupabaseEnvConfigured) {
      const result = await supabase.from(SUBSCRIPTIONS_TABLE).select('id').limit(0);
      // bank_accounts table does not exist yet — skip persistence until created
      void result;
    }

    return bankAccount;
  }

  async fetchTransactions(
    accountId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<Transaction[]> {
    const params = new URLSearchParams({ accountId });
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    const transactions = await this.proxyFetch<Transaction[]>(
      `/banking/transactions?${params}`,
      undefined,
      'GET',
    );

    // Persistence is deferred until the transactions table schema
    // matches the banking contract (currently it's a wallet-service table).

    return transactions;
  }

  async detectSubscriptions(
    accountId: string,
  ): Promise<SubscriptionDetection[]> {
    const detections = await this.proxyFetch<SubscriptionDetection[]>(
      '/ai/detect-subscriptions',
      { accountId, analysisDepth: 'deep', lookbackMonths: 12 },
    );

    // Store confirmed detections in the canonical subscriptions table so the
    // rest of the app sees the same persisted contract as fresh installs.
    if (isSupabaseEnvConfigured) {
      for (const d of detections) {
        if (d.confidence < 0.8) continue; // only high-confidence

        const subscriptionInsert = {
          user_id: this.userId,
          name: d.merchant,
          category: d.category,
          status: 'Active',
          plan_name: d.frequency,
          monthly_cost: d.amount,
          currency: 'USD',
          billing_cycle:
            d.frequency === 'monthly'
              ? 'Monthly'
              : d.frequency === 'yearly'
                ? 'Annually'
                : 'Weekly',
          renewal_date: d.nextBilling,
          payment_method: 'Bank detected',
        } satisfies SubscriptionInsert;

        const { data: existingSubscription, error: existingError } = await (
          supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
            select: (columns: string) => {
              eq: (column: string, value: string) => {
                eq: (nestedColumn: string, nestedValue: string) => {
                  limit: (count: number) => {
                    maybeSingle: () => Promise<{
                      data: { id: string } | null;
                      error: { message: string } | null;
                    }>;
                  };
                };
              };
            };
          }
        )
          .select('id')
          .eq('user_id', this.userId)
          .eq('name', d.merchant)
          .limit(1)
          .maybeSingle();

        if (existingError) {
          throw new Error(
            `Supabase load detected subscription failed: ${existingError.message}`,
          );
        }

        if (existingSubscription?.id) {
          const subscriptionUpdate = {
            category: subscriptionInsert.category,
            status: subscriptionInsert.status,
            plan_name: subscriptionInsert.plan_name,
            monthly_cost: subscriptionInsert.monthly_cost,
            currency: subscriptionInsert.currency,
            billing_cycle: subscriptionInsert.billing_cycle,
            renewal_date: subscriptionInsert.renewal_date,
            payment_method: subscriptionInsert.payment_method,
          } satisfies SubscriptionUpdate;

          const updateResult = await (
            supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
              update: (values: SubscriptionUpdate) => {
                eq: (column: string, value: string) => {
                  eq: (
                    nestedColumn: string,
                    nestedValue: string,
                  ) => Promise<{ error: { message: string } | null }>;
                };
              };
            }
          )
            .update(subscriptionUpdate)
            .eq('id', existingSubscription.id)
            .eq('user_id', this.userId);

          this.assertSupabaseWrite(
            updateResult,
            'update detected subscription',
          );
        } else {
          const insertResult = await (
            supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
              insert: (
                values: SubscriptionInsert,
              ) => Promise<{ error: { message: string } | null }>;
            }
          ).insert(subscriptionInsert);

          this.assertSupabaseWrite(
            insertResult,
            'insert detected subscription',
          );
        }
      }
    }

    return detections;
  }

  async getSpendingInsights(accountId: string): Promise<unknown> {
    return this.proxyFetch('/ai/spending-insights', {
      accountId,
      analysisType: 'comprehensive',
      includeRecommendations: true,
    });
  }

  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<boolean> {
    const result = await this.proxyFetch<{ success: boolean }>(
      '/subscriptions/cancel',
      { subscriptionId, reason, requestCancellation: true },
    );

    // Update the canonical subscriptions table and use deactivation_date
    // for cancellation timestamps.
    if (isSupabaseEnvConfigured) {
      const subscriptionUpdate = {
        status: 'Inactive',
        deactivation_date: new Date().toISOString(),
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled via MCP',
      } satisfies SubscriptionUpdate;

      const writeResult = await supabase
        .from(SUBSCRIPTIONS_TABLE)
        .update(subscriptionUpdate as never)
        .eq('id', subscriptionId)
        .eq('user_id', this.userId);

      this.assertSupabaseWrite(writeResult, 'cancel subscription');
    }

    return result.success;
  }

  async getConnectedAccounts(): Promise<BankAccount[]> {
    // bank_accounts table does not exist yet.
    // Return empty until the table is created.
    if (!isSupabaseEnvConfigured) return [];
    return [];
  }

  async syncAccount(accountId: string): Promise<void> {
    await this.proxyFetch('/banking/sync', { accountId });
  }

  async disconnectAccount(accountId: string): Promise<void> {
    await this.proxyFetch('/banking/disconnect', { accountId });
  }
}

// ── factory ──────────────────────────────────────────────────

export const createMCPBankingService = (userId: string): MCPBankingService => {
  // proxyBaseUrl is the origin of the running app — API routes live
  // under /api/banking/*.  On web this is window.location.origin;
  // on native it falls back to the EXPO_PUBLIC_API_URL env var.
  const proxyBaseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_API_URL ?? '');

  const normalizedProxyBaseUrl = proxyBaseUrl.replace(/\/+$/, '');
  if (!normalizedProxyBaseUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_URL or window.location.origin must be set',
    );
  }

  return new MCPBankingService({ proxyBaseUrl: normalizedProxyBaseUrl }, userId);
};
