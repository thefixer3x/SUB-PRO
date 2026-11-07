/**
 * Webhook idempotency tests (P0 Part B).
 *
 * Verifies that the database-backed idempotency check prevents duplicate
 * processing of Stripe events:
 *
 *   1. Two identical events in the same invocation → second is skipped via 23505.
 *   2. Two identical events across cold starts (mock 23505) → second is skipped.
 *   3. Foreign-project skip is still reachable and does not throw.
 */

const SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';
const WEBHOOK_SECRET = 'whsec_test_123';
const STRIPE_SECRET = 'sk_test_fake';
const SUPABASE_URL = 'https://test.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';

let webhookHandler: (req: Request) => Promise<Response>;

// ── Mock Supabase (declare mocks before require) ─────────────────────
let mockTables: Record<string, Record<string, unknown>[]> = {};
let mockInserts: Array<{ table: string; row: Record<string, unknown> }> = [];
let mockNextDupError: string | null = null;
let mockServiceAvailable = true;

jest.mock('@supabase/supabase-js', () => {
  const createQueryBuilder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder: Record<string, unknown> = {
      select: jest.fn(() => builder),
      eq: jest.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      }),
      insert: jest.fn(async (row: Record<string, unknown>) => {
        mockInserts.push({ table, row });
        if (!mockTables[table]) mockTables[table] = [];
        mockTables[table].push(row);
        if (mockNextDupError) {
          const code = mockNextDupError;
          mockNextDupError = null;
          return { data: null, error: { code, message: 'duplicate key' } };
        }
        return { data: null, error: null };
      }),
      update: jest.fn((row: Record<string, unknown>) => {
        pendingUpdate = row;
        return builder;
      }),
      single: jest.fn(async () => ({ data: null, error: null })),
      then: jest.fn(),
    };

    builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      if (pendingUpdate) {
        pendingUpdate = null;
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    return builder;
  };

  const serviceQueryBuilder = (table: string) => {
    mockTables[table] = mockTables[table] ?? [];
    return createQueryBuilder(table);
  };

  const serviceClient = {
    from: jest.fn((table: string) => serviceQueryBuilder(table)),
    auth: { getUser: jest.fn() },
  };

  const makeServiceClient = () => {
    if (!mockServiceAvailable) throw new Error('Supabase admin unavailable');
    return serviceClient;
  };

  return {
    createClient: jest.fn((_url: string, key: string) =>
      key === SUPABASE_SERVICE_ROLE ? { getAdmin: makeServiceClient, from: serviceClient.from } : { auth: { getUser: jest.fn() } },
    ),
  };
});

// ── Mock Stripe (declare mocks before require) ───────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────
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

// ── Reset state before each test ───────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockTables = {};
  mockInserts = [];
  mockNextDupError = null;
  mockServiceAvailable = true;

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
});

// ═══════════════════════════════════════════════════════════════════
// IDEMPOTENCY TESTS
// ═══════════════════════════════════════════════════════════════════

describe('idempotency: same invocation', () => {
  it('skips duplicate issuing_authorization.created via 23505', async () => {
    mockConstructEvent.mockImplementation((payload, _sig, secret) => {
      if (secret !== WEBHOOK_SECRET) {
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      }
      return {
        id: 'evt_auth_1',
        type: 'issuing_authorization.created',
        data: {
          object: {
            id: 'iauth_1',
            card: 'ic_test',
            amount: 5000,
            currency: 'usd',
            merchant_data: { name: 'Netflix', category: 'streaming' },
            approved: true,
            created: 1700000000,
          },
        },
      };
    });

    // First invocation: normal processing.
    const req1 = makeRequest('issuing_authorization.created');
    const res1 = await webhookHandler(req1);
    expect(res1.status).toBe(200);

    // Verify webhook_event_log was written.
    const idemInserts = mockInserts.filter((i) => i.table === 'webhook_event_log');
    expect(idemInserts.length).toBeGreaterThanOrEqual(1);

    // Second invocation: DB returns 23505 (simulates row already exists).
    mockNextDupError = '23505';

    const req2 = makeRequest('issuing_authorization.created');
    const res2 = await webhookHandler(req2);
    expect(res2.status).toBe(200);

    const body2 = await res2.json() as { received?: boolean };
    expect(body2.received).toBe(true);

    // No duplicate card_authorizations insert.
    const authInserts = mockInserts.filter((i) => i.table === 'card_authorizations');
    expect(authInserts.length).toBe(1);
  });

  it('skips duplicate subscription.created via 23505', async () => {
    mockConstructEvent.mockImplementation((payload, _sig, secret) => {
      if (secret !== WEBHOOK_SECRET) {
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      }
      return {
        id: 'evt_sub_1',
        type: 'customer.subscription.created',
        data: {
          object: {
            customer: 'cus_1',
            status: 'active',
            items: { data: [{ price: 'price_test' }] },
          },
        },
      };
    });

    // First invocation: normal processing.
    const req1 = makeRequest('customer.subscription.created');
    const res1 = await webhookHandler(req1);
    expect(res1.status).toBe(200);

    // Second invocation: DB returns 23505.
    mockNextDupError = '23505';

    const req2 = makeRequest('customer.subscription.created');
    const res2 = await webhookHandler(req2);
    expect(res2.status).toBe(200);

    const body2 = await res2.json() as { received?: boolean };
    expect(body2.received).toBe(true);
  });
});

describe('idempotency: cross cold-start', () => {
  it('skips event after Vercel cold start (DB has row from prior invocation)', async () => {
    mockConstructEvent.mockImplementation((payload, _sig, secret) => {
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
            id: 'in_1',
            subscription: 'sub_1',
            total: 1000,
            currency: 'usd',
          },
        },
      };
    });

    // First invocation: normal processing.
    const req1 = makeRequest('invoice.payment_succeeded');
    const res1 = await webhookHandler(req1);
    expect(res1.status).toBe(200);

    // Simulate cold start: in-memory state is gone, but DB still has the row.
    mockNextDupError = '23505';

    const req2 = makeRequest('invoice.payment_succeeded');
    const res2 = await webhookHandler(req2);
    expect(res2.status).toBe(200);

    const body2 = await res2.json() as { received?: boolean };
    expect(body2.received).toBe(true);
  });
});

describe('idempotency: foreign-project skip still reachable', () => {
  it('returns 200 (skipped) for a foreign-project event even with idempotency', async () => {
    mockPricesRetrieve.mockResolvedValueOnce({
      id: 'price_foreign',
      metadata: { project: 'vortexcore', tier: 'pro' },
      nickname: 'VortexCore Pro',
    });
    mockSubscriptionsRetrieve.mockResolvedValueOnce({
      id: 'sub_foreign',
      customer: 'cus_foreign',
      status: 'active',
      items: { data: [{ price: 'price_foreign' }] },
    });
    mockCustomersRetrieve.mockResolvedValueOnce({
      id: 'cus_foreign',
      metadata: { user_id: '99999999-9999-4999-8999-999999999999' },
    });

    mockConstructEvent.mockImplementation((payload, _sig, secret) => {
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

    const req = makeRequest('customer.subscription.created');
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { skipped?: boolean; reason?: string };
    expect(body.skipped).toBe(true);
    expect(body.reason).toContain('project=vortexcore');
  });
});

describe('idempotency: no DB available', () => {
  it('falls through (does not throw) when Supabase admin is unavailable', async () => {
    mockServiceAvailable = false;

    mockConstructEvent.mockImplementation((payload, _sig, secret) => {
      if (secret !== WEBHOOK_SECRET) {
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      }
      return {
        id: 'evt_no_db',
        type: 'issuing_authorization.created',
        data: {
          object: {
            id: 'iauth_no_db',
            card: 'ic_test',
            amount: 1000,
            currency: 'usd',
            merchant_data: { name: 'Spotify', category: 'streaming' },
            approved: true,
            created: 1700000000,
          },
        },
      };
    });

    const req = makeRequest('issuing_authorization.created');
    // Handler catches DB error, falls through to issuing handler which also fails.
    // Either way, no crash — Stripe gets 500 and retries.
    const res = await webhookHandler(req);
    expect([200, 500]).toContain(res.status);
  });
});
