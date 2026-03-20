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

type BankAccountRow = Database['public']['Tables']['bank_accounts']['Row'];
type BankAccountInsert = Database['public']['Tables']['bank_accounts']['Insert'];
type BankAccountUpdate = Database['public']['Tables']['bank_accounts']['Update'];
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

const BANK_ACCOUNTS_TABLE: keyof Database['public']['Tables'] = 'bank_accounts';
const SUBSCRIPTIONS_TABLE: keyof Database['public']['Tables'] = 'subscriptions';
const SUBSCRIPTION_CONFLICT_COLUMNS = 'user_id,detection_key';
const RELATIVE_BANKING_PROXY_URL = '/api/banking/proxy';
const NETLIFY_BANKING_PROXY_PATH = '/banking-proxy';

const unique = <T,>(values: T[]): T[] =>
  values.filter((value, index) => values.indexOf(value) === index);

const normalizeKeyPart = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

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

const buildSubscriptionDetectionKey = (
  accountId: string,
  detection: SubscriptionDetection,
  monthlyCost: number,
  billingCycle: SubscriptionInsert['billing_cycle'],
): string => {
  const transactionAnchor = [...detection.transactions]
    .filter(
      (transaction): transaction is Transaction & { id: string } =>
        typeof transaction.id === 'string' && Boolean(transaction.id.trim()),
    )
    .sort((left, right) => {
      const leftTime = new Date(left.date).getTime();
      const rightTime = new Date(right.date).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.id.localeCompare(right.id);
    })[0]?.id.trim();

  return [
    normalizeKeyPart(accountId),
    normalizeKeyPart(detection.merchant),
    monthlyCost.toFixed(2),
    normalizeKeyPart(billingCycle),
    normalizeKeyPart(detection.category),
    transactionAnchor || detection.nextBilling,
  ].join('::');
};

const mapBankAccountRow = (row: BankAccountRow): BankAccount => ({
  id: row.id,
  bankName: row.bank_name,
  accountType: row.account_type,
  accountNumber: row.account_number ?? undefined,
  balance: row.balance,
  currency: row.currency,
  isConnected: row.is_connected,
  lastSync: row.last_sync,
});

const buildBankAccountInsert = (
  userId: string,
  account: BankAccount,
): BankAccountInsert => ({
  id: account.id,
  user_id: userId,
  bank_name: account.bankName,
  account_type: account.accountType,
  account_number: account.accountNumber ?? null,
  balance: account.balance,
  currency: account.currency,
  is_connected: account.isConnected,
  last_sync: account.lastSync,
});

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
    urls.push(RELATIVE_BANKING_PROXY_URL);
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
      const accountInsert = buildBankAccountInsert(this.userId, bankAccount);

      const writeResult = await (
        supabase.from(BANK_ACCOUNTS_TABLE) as unknown as {
          upsert: (
            values: BankAccountInsert,
            options: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(accountInsert, {
        onConflict: 'id',
      });

      this.assertSupabaseWrite(writeResult, 'persist connected bank account');
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
        const detectionKey = buildSubscriptionDetectionKey(
          accountId,
          d,
          monthlyCost,
          billingCycle,
        );

        const subscriptionInsert = {
          user_id: this.userId,
          detection_key: detectionKey,
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
          onConflict: SUBSCRIPTION_CONFLICT_COLUMNS,
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
    if (!isSupabaseEnvConfigured) return [];

    const result = await supabase
      .from(BANK_ACCOUNTS_TABLE)
      .select(
        'id, bank_name, account_type, account_number, balance, currency, is_connected, last_sync',
      )
      .eq('user_id', this.userId)
      .eq('is_connected', true)
      .order('last_sync', { ascending: false });

    this.assertSupabaseWrite(result, 'load bank accounts');

    return ((result.data ?? []) as BankAccountRow[]).map(mapBankAccountRow);
  }

  async syncAccount(accountId: string): Promise<void> {
    await this.proxyFetch('/banking/sync', { accountId });

    if (!isSupabaseEnvConfigured) {
      return;
    }

    const update = {
      is_connected: true,
      last_sync: new Date().toISOString(),
    } satisfies BankAccountUpdate;

    const writeResult = await supabase
      .from(BANK_ACCOUNTS_TABLE)
      .update(update as never)
      .eq('id', accountId)
      .eq('user_id', this.userId);

    this.assertSupabaseWrite(writeResult, 'sync bank account');
  }

  async disconnectAccount(accountId: string): Promise<void> {
    await this.proxyFetch('/banking/disconnect', { accountId });

    if (!isSupabaseEnvConfigured) {
      return;
    }

    const update = {
      is_connected: false,
      last_sync: new Date().toISOString(),
    } satisfies BankAccountUpdate;

    const writeResult = await supabase
      .from(BANK_ACCOUNTS_TABLE)
      .update(update as never)
      .eq('id', accountId)
      .eq('user_id', this.userId);

    this.assertSupabaseWrite(writeResult, 'disconnect bank account');
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
