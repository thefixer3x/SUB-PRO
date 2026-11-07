/**
 * Webhook idempotency tests (P0 Part B, claim -> effect -> done).
 *
 * The handler now calls `claim_webhook_event` before touching the target
 * tables and `mark_webhook_event_done` only after the effect succeeds. These
 * tests pin the semantics we care about:
 *
 *   1. duplicate / in_progress -> 200, no effect
 *   2. claimed + success       -> effect runs once, then done
 *   3. claimed + failed effect -> release + 500, retry applies the effect
 *   4. claim error             -> 500 (fail closed, no effect)
 *   5. foreign project         -> 200 skipped, no claim
 *   6. mark-done failure       -> still 200 (effect already ran)
 *   7. no admin client         -> 500 (fail closed)
 */

const SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';
const WEBHOOK_SECRET = 'whsec_test_123';
const STRIPE_SECRET = 'sk_test_fake';
const SUPABASE_URL = 'https://test.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';

let webhookHandler: (req: Request) => Promise<Response>;

// ── Mock state ──────────────────────────────────────────────────────
let mockTables: Record<string, Record<string, unknown>[]> = {};
let mockInserts: Array<{ table: string; row: Record<string, unknown> }> = [];
let mockInsertError: { table: string; error: { code: string; message: string } } | null = null;
let mockClaimResults: Array<'claimed' | 'duplicate' | 'in_progress'> = [];
let mockClaimError: { message: string } | null = null;
let mockMarkDoneError: { message: string } | null = null;
let mockDoneCalls: string[] = [];
let mockReleaseCalls: string[] = [];

jest.mock('@supabase/supabase-js', () => {
  const createQueryBuilder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let rowLimit: number | undefined;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      eq: jest.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      }),
      limit: jest.fn((n: number) => {
        rowLimit = n;
        return builder;
      }),
      insert: jest.fn(async (row: Record<string, unknown>) => {
        mockInserts.push({ table, row });
        if (mockInsertError && mockInsertError.table === table) {
          const error = mockInsertError.error;
          mockInsertError = null;
          return { data: null, error };
        }
        ((mockTables[table] as Record<string, unknown>[]) ??= []).push(row);
        return { data: null, error: null };
      }),
      update: jest.fn((row: Record<string, unknown>) => {
        pendingUpdate = row;
        return builder;
      }),
      single: jest.fn(async () => {
        const rows = (mockTables[table] as Record<string, unknown>[]) ?? [];
        const filtered = rows.filter((r) =>
          filters.every(([col, val]) =>
            Array.isArray(val) ? val.includes(r[col]) : r[col] === val,
          ),
        );
        return { data: filtered[0] ?? null, error: null };
      }),
      then: jest.fn(),
    };

    builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      const rows = (mockTables[table] as Record<string, unknown>[]) ?? [];
      const filtered = rows.filter((r) =>
        filters.every(([col, val]) =>
          Array.isArray(val) ? val.includes(r[col]) : r[col] === val,
        ),
      );
      if (pendingUpdate) {
        for (const r of filtered) Object.assign(r, pendingUpdate);
        pendingUpdate = null;
      }
      const limited = typeof rowLimit === 'number' ? filtered.slice(0, rowLimit) : filtered;
      return Promise.resolve({ data: limited, error: null }).then(resolve, reject);
    };

    return builder;
  };

  const serviceClient = {
    from: jest.fn((table: string) => createQueryBuilder(table)),
    rpc: jest.fn(async (fn: string, args: Record<string, string>) => {
      if (fn === 'claim_webhook_event') {
        if (mockClaimError) {
          const error = mockClaimError;
          mockClaimError = null;
          return { data: null, error };
        }
        const result = mockClaimResults.length > 0 ? mockClaimResults.shift() : 'claimed';
        return { data: result, error: null };
      }
      if (fn === 'mark_webhook_event_done') {
        if (mockMarkDoneError) {
          const error = mockMarkDoneError;
          mockMarkDoneError = null;
          return { data: null, error };
        }
        mockDoneCalls.push(args.p_event_id);
        return { data: null, error: null };
      }
      if (fn === 'release_webhook_event') {
        mockReleaseCalls.push(args.p_event_id);
        return { data: null, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${fn}` } };
    }),
    auth: { getUser: jest.fn() },
  };

  return {
    createClient: jest.fn((_url: string, key: string) =>
      key === SUPABASE_SERVICE_ROLE ? serviceClient : { auth: { getUser: jest.fn() } },
    ),
  };
});

// ── Mock Stripe ─────────────────────────────────────────────────────
const mockCustomersRetrieve = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockPricesRetrieve = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  class MockStripe {
    customers = { retrieve: mockCustomersRetrieve };
    subscriptions = { retrieve: mockSubscriptionsRetrieve };
    prices = { retrieve: mockPricesRetrieve };
    webhooks = { constructEvent: mockConstructEvent };
    key: string;
    constructor(key: string) { this.key = key; }
  }
  return { __esModule: true, default: MockStripe };
});

// ── Helpers ─────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = STRIPE_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';
  process.env.SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  webhookHandler = require('../api/stripe/webhook').default.fetch;
});

function makeRequest(eventType: string): Request {
  return new Request('https://test.local/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'sig_ok',
    },
    body: JSON.stringify({ type: eventType }),
  });
}

function authEvent(id = 'evt_auth_1') {
  return {
    id,
    type: 'issuing_authorization.created',
    data: {
      object: {
        id: `iauth_${id}`,
        card: 'ic_test',
        amount: 5000,
        currency: 'usd',
        merchant_data: { name: 'Netflix', category: 'streaming' },
        approved: true,
        created: 1700000000,
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTables = {};
  mockInserts = [];
  mockInsertError = null;
  mockClaimResults = [];
  mockClaimError = null;
  mockMarkDoneError = null;
  mockDoneCalls = [];
  mockReleaseCalls = [];

  mockCustomersRetrieve.mockResolvedValue({
    id: 'cus_1',
    metadata: { user_id: SESSION_USER_ID },
  });
  mockSubscriptionsRetrieve.mockResolvedValue({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    items: { data: [{ price: 'price_test' }] },
  });
  mockPricesRetrieve.mockResolvedValue({
    id: 'price_test',
    metadata: { project: 'subtrack', tier: 'pro' },
    nickname: 'Test Pro',
  });
  mockConstructEvent.mockImplementation((_payload: string, _sig: string, secret: string) => {
    if (secret !== WEBHOOK_SECRET) {
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    }
    return authEvent();
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLAIM OUTCOMES
// ═══════════════════════════════════════════════════════════════════

describe('idempotency: duplicate and in-flight events', () => {
  it.each(['duplicate', 'in_progress'] as const)(
    'returns 200 without writing when the claim says %s',
    async (claim) => {
      mockClaimResults = [claim];

      const res = await webhookHandler(makeRequest('issuing_authorization.created'));
      expect(res.status).toBe(200);

      const body = await res.json() as { received?: boolean; skipped?: string };
      expect(body.received).toBe(true);
      expect(body.skipped).toBe(claim);

      expect(mockInserts.filter((i) => i.table === 'card_authorizations')).toHaveLength(0);
      expect(mockDoneCalls).toHaveLength(0);
    },
  );

  it('processes a claimed event once and marks it done', async () => {
    mockClaimResults = ['claimed'];

    const res = await webhookHandler(makeRequest('issuing_authorization.created'));
    expect(res.status).toBe(200);

    expect(mockInserts.filter((i) => i.table === 'card_authorizations')).toHaveLength(1);
    expect(mockDoneCalls).toEqual(['evt_auth_1']);
    expect(mockReleaseCalls).toHaveLength(0);
  });
});

describe('idempotency: failed effect releases the claim', () => {
  it('returns 500, releases, and lets the retry apply the effect', async () => {
    // First delivery: the effect fails, so no row is stored.
    mockClaimResults = ['claimed'];
    mockInsertError = {
      table: 'card_authorizations',
      error: { code: 'XX000', message: 'connection reset' },
    };

    const res1 = await webhookHandler(makeRequest('issuing_authorization.created'));
    expect(res1.status).toBe(500);
    expect(mockReleaseCalls).toEqual(['evt_auth_1']);
    expect(mockDoneCalls).toHaveLength(0);
    expect((mockTables['card_authorizations'] ?? [])).toHaveLength(0);

    // Stripe retries: the claim is free again and the write succeeds.
    mockClaimResults = ['claimed'];
    const res2 = await webhookHandler(makeRequest('issuing_authorization.created'));
    expect(res2.status).toBe(200);
    expect((mockTables['card_authorizations'] ?? [])).toHaveLength(1);
    expect(mockDoneCalls).toEqual(['evt_auth_1']);
  });
});

describe('idempotency: fail closed', () => {
  it('returns 500 and writes nothing when the claim RPC errors', async () => {
    mockClaimError = { message: 'relation "webhook_event_log" does not exist' };

    const res = await webhookHandler(makeRequest('issuing_authorization.created'));
    expect(res.status).toBe(500);
    expect(mockInserts.filter((i) => i.table === 'card_authorizations')).toHaveLength(0);
  });

  it('returns 500 and writes nothing when the admin client is unavailable', async () => {
    const saved = {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      key: process.env.SUPABASE_SECRET_KEY,
    };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;

    try {
      const res = await webhookHandler(makeRequest('issuing_authorization.created'));
      expect(res.status).toBe(500);
      expect(mockInserts.filter((i) => i.table === 'card_authorizations')).toHaveLength(0);
    } finally {
      if (saved.url !== undefined) process.env.EXPO_PUBLIC_SUPABASE_URL = saved.url;
      if (saved.key !== undefined) process.env.SUPABASE_SECRET_KEY = saved.key;
    }
  });
});

describe('idempotency: mark-done failure does not retry the effect', () => {
  it('still returns 200 when mark done fails after the write succeeded', async () => {
    mockClaimResults = ['claimed'];
    mockMarkDoneError = { message: 'timeout' };

    const res = await webhookHandler(makeRequest('issuing_authorization.created'));
    expect(res.status).toBe(200);
    expect(mockInserts.filter((i) => i.table === 'card_authorizations')).toHaveLength(1);
    expect(mockReleaseCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// INVOICE EVENTS
// ═══════════════════════════════════════════════════════════════════

describe('invoice events: stripe ids never go into a uuid column', () => {
  it('stores the payment with a null subscription_id for a Stripe subscription id', async () => {
    mockClaimResults = ['claimed'];
    mockConstructEvent.mockImplementation((_payload: string, _sig: string, secret: string) => {
      if (secret !== WEBHOOK_SECRET) {
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      }
      return {
        id: 'evt_invoice_1',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test_1',
            subscription: 'sub_1', // Stripe id, not a uuid
            total: 1900,
            currency: 'usd',
          },
        },
      };
    });

    const res = await webhookHandler(makeRequest('invoice.payment_succeeded'));
    expect(res.status).toBe(200);

    const rows = mockInserts.filter((i) => i.table === 'sm_payment_records');
    expect(rows).toHaveLength(1);
    expect(rows[0].row.subscription_id).toBeNull();
    expect(rows[0].row.stripe_invoice_id).toBe('in_test_1');
    expect(mockDoneCalls).toEqual(['evt_invoice_1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FOREIGN PROJECT
// ═══════════════════════════════════════════════════════════════════

describe('idempotency: foreign-project skip still reachable', () => {
  it('returns 200 skipped and never claims a foreign-project event', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_foreign',
      metadata: { project: 'vortexcore', tier: 'pro' },
      nickname: 'VortexCore Pro',
    });
    mockConstructEvent.mockImplementation((_payload: string, _sig: string, secret: string) => {
      if (secret !== WEBHOOK_SECRET) {
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      }
      return {
        id: 'evt_foreign',
        type: 'customer.subscription.created',
        data: {
          object: {
            customer: 'cus_foreign',
            status: 'active',
            items: { data: [{ price: 'price_foreign' }] },
          },
        },
      };
    });

    const res = await webhookHandler(makeRequest('customer.subscription.created'));
    expect(res.status).toBe(200);

    const body = await res.json() as { skipped?: boolean; reason?: string };
    expect(body.skipped).toBe(true);
    expect(body.reason).toContain('project=vortexcore');
    expect(mockInserts).toHaveLength(0);
    expect(mockDoneCalls).toHaveLength(0);
  });
});
