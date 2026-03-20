import { Platform } from 'react-native';
import { supabase, isSupabaseEnvConfigured } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import {
  buildApiBases,
  buildUrl,
  DEFAULT_API_TIMEOUT_MS,
  fetchWithTimeout,
} from '@/lib/apiClient';

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
  /** Candidate URLs for our own server-side banking proxy. */
  proxyUrls: string[];
}

type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

const SUBSCRIPTIONS_TABLE: keyof Database['public']['Tables'] = 'subscriptions';
const SUBSCRIPTION_IDENTITY_COLUMNS =
  'user_id,name,monthly_cost,billing_cycle,category';
const RELATIVE_BANKING_PROXY_URL = '/api/banking/proxy';
const NETLIFY_BANKING_PROXY_PATH = '/banking-proxy';

const unique = <T,>(values: T[]): T[] =>
  values.filter((value, index) => values.indexOf(value) === index);

const toBillingCycle = (
  frequency: SubscriptionDetection['frequency'],
): SubscriptionInsert['billing_cycle'] => {
  switch (frequency) {
    case 'yearly':
      return 'Annually';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
    default:
      return 'Monthly';
  }
};

const roundCurrency = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const normalizeToMonthlyAmount = (
  amount: number,
  frequency: SubscriptionDetection['frequency'],
): number => {
  switch (frequency) {
    case 'yearly':
      return roundCurrency(amount / 12);
    case 'weekly':
      return roundCurrency((amount * 52) / 12);
    case 'monthly':
    default:
      return roundCurrency(amount);
  }
};

const extractProxyError = async (response: Response): Promise<string | null> => {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
      ) {
        return data.error;
      }

      return JSON.stringify(data);
    }

    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
};

const buildBankingProxyUrls = (): string[] => {
  const functionBases = buildApiBases(
    [
      process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL,
      process.env.EXPO_PUBLIC_EMBEDDED_FINANCE_API_FALLBACK_URL,
      process.env.EXPO_PUBLIC_API_BASE_URL,
      process.env.EXPO_PUBLIC_API_FALLBACK_URL,
    ],
    { includeRelative: false },
  );

  const urls = functionBases.map((base) =>
    buildUrl(base, NETLIFY_BANKING_PROXY_PATH),
  );

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    urls.unshift(RELATIVE_BANKING_PROXY_URL);
  }

  return unique(urls.filter((url) => Boolean(url.trim())));
};

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

    const requestBody = JSON.stringify({ path, payload, method });
    const requestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
    const errors: string[] = [];

    for (const proxyUrl of this.config.proxyUrls) {
      try {
        const res = await fetchWithTimeout(
          proxyUrl,
          {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody,
          },
          DEFAULT_API_TIMEOUT_MS,
        );

        if (!res.ok) {
          const message = await extractProxyError(res);
          errors.push(
            `${res.status} ${res.statusText} for ${proxyUrl}${
              message ? `: ${message}` : ''
            }`,
          );
          continue;
        }

        return (await res.json()) as T;
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Request to ${proxyUrl} failed: ${reason}`);
      }
    }

    throw new Error(errors.join('; ') || 'Banking proxy request failed');
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
        const monthlyCost = normalizeToMonthlyAmount(d.amount, d.frequency);
        const billingCycle = toBillingCycle(d.frequency);

        const subscriptionInsert = {
          user_id: this.userId,
          name: d.merchant,
          category: d.category,
          status: 'Active',
          plan_name: d.frequency,
          monthly_cost: monthlyCost,
          currency: 'USD',
          billing_cycle: billingCycle,
          renewal_date: d.nextBilling,
          payment_method: 'Bank detected',
        } satisfies SubscriptionInsert;

        const upsertResult = await (
          supabase.from(SUBSCRIPTIONS_TABLE) as unknown as {
            upsert: (
              values: SubscriptionInsert,
              options: { onConflict: string },
            ) => Promise<{ error: { message: string } | null }>;
          }
        ).upsert(subscriptionInsert, {
          onConflict: SUBSCRIPTION_IDENTITY_COLUMNS,
        });

        this.assertSupabaseWrite(
          upsertResult,
          'upsert detected subscription',
        );
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

    if (!result.success) {
      return false;
    }

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
  const proxyUrls = buildBankingProxyUrls();

  if (!proxyUrls.length) {
    throw new Error(
      'Configure EXPO_PUBLIC_API_BASE_URL/EXPO_PUBLIC_EMBEDDED_FINANCE_API_BASE_URL or serve /api/banking/proxy on the current origin.',
    );
  }

  return new MCPBankingService({ proxyUrls }, userId);
};
