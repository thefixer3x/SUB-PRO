/**
 * Unit tests for S201: Vercel checkout + Stripe webhook handlers.
 *
 * Covers every Accept-when criterion:
 *   - bad signature → 400
 *   - foreign-project price → 200 with no DB call
 *   - SubTrack price → profiles.subscription_tier set from metadata.tier
 *   - issuing_card.created processed despite carrying no price
 *   - body userId/email differing from session is ignored
 *   - success/cancel URL off-allowlist → 400
 *   - no token → 401
 */

import fs from 'fs';
import path from 'path';

// ── Environment setup + handler loading ──────────────────────────
const SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ALLOWED_ORIGIN = 'https://subtrack-pro.lanonasis.com';
const FOREIGN_ORIGIN = 'https://evil.example.com';
const WEBHOOK_SECRET = 'whsec_test_123';
const STRIPE_SECRET = 'sk_test_fake_s201';
const SUPABASE_URL = 'https://test.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';

let checkoutHandler: (req: Request) => Promise<Response>;
let webhookHandler: (req: Request) => Promise<Response>;

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = STRIPE_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON;
  process.env.SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE;
  process.env.ALLOWED_ORIGINS = `${ALLOWED_ORIGIN},https://subtrack.lanonasis.com`;
  process.env.SITE_URL = ALLOWED_ORIGIN;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  checkoutHandler = require('../api/create-checkout-session').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  webhookHandler = require('../api/stripe/webhook').default;
});

// ── Mock Supabase ──────────────────────────────────────────────────
let mockTables: Record<string, Record<string, unknown>[]> = {};
let mockInserts: Array<{ table: string; row: Record<string, unknown> }> = [];
let mockUpdateCalls: Array<{ table: string; data: Record<string, unknown> }> = [];
let trackedTables: string[] = [];
let mockAuthUser: { id: string; email: string | null; user_metadata: Record<string, unknown> } | null = null;
let mockAuthError: { message: string; status?: number; code?: string } | null = null;
let mockAuthThrows = false;

jest.mock('@supabase/supabase-js', () => {
  const createQueryBuilder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let rowLimit: number | undefined;

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
        ((mockTables[table] as Record<string, unknown>[]) ??= []).push(row);
        return { data: null, error: null };
      }),
      update: jest.fn(async (row: Record<string, unknown>) => {
        mockUpdateCalls.push({ table, data: row });
        const rows = mockTables[table] as Record<string, unknown>[] | undefined;
        if (rows) {
          for (const r of rows) {
            const matches = filters.every(([col, val]) => r[col] === val);
            if (matches) Object.assign(r, row);
          }
        }
        return { data: null, error: null };
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
      const limited = typeof rowLimit === 'number' ? filtered.slice(0, rowLimit) : filtered;
      return Promise.resolve({ data: limited, error: null }).then(resolve, reject);
    };

    return builder;
  };

  const authClient = {
    auth: {
      getUser: jest.fn(async (token: string) => {
        if (token === 'valid-token' && mockAuthThrows) {
          throw new Error('network timeout');
        }
        if (token === 'valid-token' && mockAuthError) {
          return { data: { user: null }, error: mockAuthError };
        }
        if (token === 'valid-token') {
          return { data: { user: mockAuthUser }, error: null };
        }
        return {
          data: { user: null },
          error: mockAuthError ?? { message: 'invalid', status: 401, code: 'invalid_token' },
        };
      }),
    },
  };

  const serviceClient = {
    from: jest.fn((table: string) => {
      trackedTables.push(table);
      return createQueryBuilder(table);
    }),
    auth: { getUser: jest.fn() },
  };

  return {
    createClient: jest.fn((_url: string, key: string) =>
      key === SUPABASE_SERVICE_ROLE ? serviceClient : authClient,
    ),
  };
});

// ── Mock Stripe ────────────────────────────────────────────────────
interface MockCheckout { sessions: { create: jest.Mock } };
interface MockStripeApi {
  prices: { list: jest.Mock; retrieve: jest.Mock };
  checkout: MockCheckout;
  customers: { retrieve: jest.Mock };
  subscriptions: { retrieve: jest.Mock };
  webhooks: { constructEvent: jest.Mock };
}
const mockStripeApi: MockStripeApi = {
  prices: { list: jest.fn(), retrieve: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  customers: { retrieve: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

class MockStripe {
  prices = mockStripeApi.prices;
  checkout = mockStripeApi.checkout;
  customers = mockStripeApi.customers;
  subscriptions = mockStripeApi.subscriptions;
  webhooks = mockStripeApi.webhooks;
  key: string;
  constructor(key: string) { this.key = key; }
}

jest.mock('stripe', () => ({
  __esModule: true,
  default: MockStripe,
  __mockStripeApi: mockStripeApi,
}));

// ── Helpers ────────────────────────────────────────────────────────
function makeRequestObject(overrides: {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  url?: string;
} = {}): Request {
  return new Request(overrides.url ?? 'https://test.local/api/test', {
    method: overrides.method ?? 'POST',
    headers: overrides.headers as HeadersInit,
    body: overrides.body,
  });
}

// ── Reset state before each test ───────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockTables = {};
  mockInserts = [];
  mockUpdateCalls = [];
  trackedTables = [];
  mockAuthUser = {
    id: SESSION_USER_ID,
    email: 'user@example.com',
    user_metadata: {},
  };
  mockAuthError = null;
  mockAuthThrows = false;

  // Default SubTrack Pro price.
  mockStripeApi.prices.list.mockResolvedValue({
    data: [{
      id: 'price_subtrack_monthly',
      lookup_keys: ['subtrack_pro_monthly'],
      metadata: { project: 'subtrack', tier: 'pro' },
      nickname: 'SubTrack Pro Monthly',
    }],
    has_more: false,
  });
  mockStripeApi.prices.retrieve.mockResolvedValue({
    id: 'price_subtrack_monthly',
    metadata: { project: 'subtrack', tier: 'pro' },
    nickname: 'SubTrack Pro Monthly',
  });
  mockStripeApi.checkout.sessions.create.mockResolvedValue({
    id: 'cs_test_1',
    url: 'https://checkout.stripe.com/c/...',
  });
  mockStripeApi.customers.retrieve.mockResolvedValue({
    id: 'cus_1',
    metadata: { user_id: SESSION_USER_ID },
  });
  mockStripeApi.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    items: {
      data: [{ price: { id: 'price_subtrack_monthly', metadata: { project: 'subtrack', tier: 'pro' } } }],
    },
  });
  mockStripeApi.webhooks.constructEvent.mockImplementation((_payload: string, _sig: string, secret: string) => {
    if (secret === 'BAD_SECRET') {
      const err = new Error('No webhook signature found');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    }
    return {
      id: 'evt_test_1',
      type: 'customer.subscription.created',
      data: { object: {} },
    };
  });
});

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT TESTS
// ═══════════════════════════════════════════════════════════════════

describe('checkout: authentication', () => {
  it('returns 401 when there is no Authorization header', async () => {
    const req = makeRequestObject({ method: 'POST', headers: {} });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/authentication required/i);
  });

  it('returns 401 for an invalid token', async () => {
    mockAuthError = { message: 'invalid', status: 401, code: 'invalid_token' };
    const req = makeRequestObject({ method: 'POST', headers: { Authorization: 'Bearer invalid-token' } });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it('returns 503 when Supabase throws', async () => {
    mockAuthThrows = true;
    const req = makeRequestObject({ method: 'POST', headers: { Authorization: 'Bearer valid-token' } });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(503);
  });

  it('returns 503 when Supabase env is missing', async () => {
    const origUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const origKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
    const req = makeRequestObject({ method: 'POST', headers: { Authorization: 'Bearer valid-token' } });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(503);
    process.env.EXPO_PUBLIC_SUPABASE_URL = origUrl!;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origKey!;
  });
});

describe('checkout: user identity', () => {
  it('uses the verified session user id, ignores userId in the body', async () => {
    mockAuthUser = { id: SESSION_USER_ID, email: 'session@example.com', user_metadata: {} };
    const req = makeRequestObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        origin: ALLOWED_ORIGIN,
      },
      body: JSON.stringify({ userId: OTHER_USER_ID, email: 'attacker@example.com' }),
    });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(200);
    expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalled();
    const call = (mockStripeApi.checkout.sessions.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect((call.metadata as Record<string, unknown>)['user_id']).toBe(SESSION_USER_ID);
  });

  it('ignores body userId/email differing from the session', async () => {
    mockAuthUser = { id: SESSION_USER_ID, email: 'session@example.com', user_metadata: {} };
    const req = makeRequestObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        origin: ALLOWED_ORIGIN,
      },
      body: JSON.stringify({ userId: OTHER_USER_ID, email: 'different@example.com' }),
    });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(200);
    const call = (mockStripeApi.checkout.sessions.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect((call as Record<string, unknown>).customer_email).toBe('session@example.com');
  });
});

describe('checkout: redirect URLs', () => {
  it('rejects when success/cancel URLs are off-allowlist', async () => {
    const origSiteUrl = process.env.SITE_URL;
    process.env.SITE_URL = 'https://evil.example.com';
    mockAuthUser = { id: SESSION_USER_ID, email: 'u@example.com', user_metadata: {} };
    const req = makeRequestObject({
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', origin: ALLOWED_ORIGIN },
    });
    const res = await checkoutHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/redirect|origin/i);
    expect(mockStripeApi.checkout.sessions.create).not.toHaveBeenCalled();
    process.env.SITE_URL = origSiteUrl!;
  });
});

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK TESTS
// ═══════════════════════════════════════════════════════════════════

describe('webhook: bad signature', () => {
  it('returns 400 for a bad signature', async () => {
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      const err = new Error('No webhook signature found');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });
    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bad_signature' },
      body: JSON.stringify({ type: 'test' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/signature/i);
  });

  it('returns 400 when the signature header is missing', async () => {
    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(400);
  });
});

describe('webhook: foreign-project price', () => {
  it('returns 200 with no DB call for a foreign-project subscription event', async () => {
    mockStripeApi.prices.retrieve.mockResolvedValueOnce({
      id: 'price_foreign',
      metadata: { project: 'vortexcore', tier: 'pro' },
      nickname: 'VortexCore Pro',
    });
    mockStripeApi.prices.list.mockResolvedValueOnce({
      data: [{ id: 'price_foreign', metadata: { project: 'vortexcore' } }],
      has_more: false,
    });
    mockStripeApi.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub_foreign',
      customer: 'cus_foreign',
      status: 'active',
      items: { data: [{ price: 'price_foreign' }] },
    });
    mockStripeApi.customers.retrieve.mockResolvedValueOnce({
      id: 'cus_foreign',
      metadata: { user_id: SESSION_USER_ID },
    });
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_foreign',
          type: 'customer.subscription.created',
          data: { object: { customer: 'cus_foreign', status: 'active', items: { data: [{ price: 'price_foreign' }] } } },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'customer.subscription.created' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);
    expect(mockInserts).toHaveLength(0);
    const body = await res.json() as { skipped?: boolean };
    expect(body.skipped).toBe(true);
  });
});

describe('webhook: SubTrack price sets subscription_tier', () => {
  it('sets profiles.subscription_tier from metadata.tier for SubTrack', async () => {
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_subtrack',
          type: 'customer.subscription.created',
          data: {
            object: {
              customer: 'cus_subtrack',
              status: 'active',
              items: { data: [{ price: 'price_subtrack_monthly' }] },
            },
          },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'customer.subscription.created' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);

    const proUpdates = mockUpdateCalls.filter((u) => u.table === 'profiles');
    expect(proUpdates.length).toBeGreaterThan(0);
    expect(proUpdates[0].data).toHaveProperty('subscription_tier', 'pro');
    expect(trackedTables).not.toContain('user_tiers');
    expect(trackedTables).not.toContain('stripe_subscriptions');
  });

  it('sets tier to the value in metadata.tier (e.g. team)', async () => {
    mockStripeApi.prices.retrieve.mockResolvedValueOnce({
      id: 'price_team',
      metadata: { project: 'subtrack', tier: 'team' },
      nickname: 'SubTrack Team Monthly',
    });
    mockStripeApi.prices.list.mockResolvedValueOnce({
      data: [{ id: 'price_team', metadata: { project: 'subtrack', tier: 'team' } }],
      has_more: false,
    });
    mockStripeApi.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub_team',
      customer: 'cus_team',
      status: 'active',
      items: { data: [{ price: 'price_team' }] },
    });
    mockStripeApi.customers.retrieve.mockResolvedValueOnce({
      id: 'cus_team',
      metadata: { user_id: SESSION_USER_ID },
    });
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_team',
          type: 'customer.subscription.created',
          data: {
            object: { customer: 'cus_team', status: 'active', items: { data: [{ price: 'price_team' }] } },
          },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({}),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);

    const teamUpdates = mockUpdateCalls.filter((u) => u.table === 'profiles');
    expect(teamUpdates.length).toBeGreaterThan(0);
    expect(teamUpdates[0].data).toHaveProperty('subscription_tier', 'team');
  });
});

describe('webhook: issuing_card.created', () => {
  it('processes issuing_card.created despite carrying no price', async () => {
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_ic_created',
          type: 'issuing_card.created',
          data: {
            object: {
              id: 'ic_test_1', last4: '4242', brand: 'visa',
              status: 'active', metadata: { user_id: SESSION_USER_ID },
            },
          },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'issuing_card.created' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);

    const inserts = mockInserts.filter((i) => i.table === 'virtual_cards');
    expect(inserts.length).toBe(1);
    expect(inserts[0].row).toHaveProperty('user_id', SESSION_USER_ID);
    expect(inserts[0].row).toHaveProperty('card_id', 'ic_test_1');
  });

  it('throws (500) when issuing_card has no user_id in metadata', async () => {
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_ic_nouser',
          type: 'issuing_card.created',
          data: {
            object: {
              id: 'ic_orphan', last4: '0000', brand: 'visa',
              status: 'active', metadata: {},
            },
          },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'issuing_card.created' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(500);
  });
});

describe('webhook: checkout.session.completed idempotency', () => {
  it('handles checkout.session.completed and sets subscription_tier', async () => {
    mockStripeApi.webhooks.constructEvent.mockImplementationOnce((_payload: string, _sig: string, secret: string) => {
      if (secret === WEBHOOK_SECRET) {
        return {
          id: 'evt_checkout_1',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_1', metadata: { user_id: SESSION_USER_ID }, subscription: 'sub_checkout' } },
        };
      }
      const err = new Error('bad sig');
      (err as any).type = 'StripeInvalidRequest';
      throw err;
    });
    mockStripeApi.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub_checkout', customer: 'cus_1', status: 'active',
      items: { data: [{ price: { id: 'price_subtrack_monthly', metadata: { project: 'subtrack', tier: 'pro' } } }] },
    });
    mockStripeApi.customers.retrieve.mockResolvedValueOnce({
      id: 'cus_1', metadata: { user_id: SESSION_USER_ID },
    });

    const req = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    const res = await webhookHandler(req);
    expect(res.status).toBe(200);

    const coUpdates = mockUpdateCalls.filter((u) => u.table === 'profiles');
    expect(coUpdates.length).toBeGreaterThan(0);
    expect(coUpdates[0].data).toHaveProperty('subscription_tier', 'pro');
  });

  it('skips duplicate event id (idempotency)', async () => {
    const makeIcEvent = () => ({
      id: 'evt_dup',
      type: 'issuing_card.created',
      data: { object: { id: 'ic_dup', last4: '1234', brand: 'mastercard', status: 'active', metadata: { user_id: SESSION_USER_ID } } },
    });

    mockStripeApi.webhooks.constructEvent
      .mockImplementationOnce((_p: string, _s: string, sec: string) => {
        if (sec === WEBHOOK_SECRET) return makeIcEvent();
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      })
      .mockImplementationOnce((_p: string, _s: string, sec: string) => {
        if (sec === WEBHOOK_SECRET) return makeIcEvent();
        const err = new Error('bad sig');
        (err as any).type = 'StripeInvalidRequest';
        throw err;
      });

    const req1 = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'issuing_card.created' }),
    });
    let res = await webhookHandler(req1);
    expect(res.status).toBe(200);
    expect(mockInserts.filter((i) => i.table === 'virtual_cards')).toHaveLength(1);

    const beforeInserts = mockInserts.filter((i) => i.table === 'virtual_cards').length;
    const req2 = makeRequestObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 'sig_ok' },
      body: JSON.stringify({ type: 'issuing_card.created' }),
    });
    res = await webhookHandler(req2);
    expect(res.status).toBe(200);
    const afterInserts = mockInserts.filter((i) => i.table === 'virtual_cards').length;
    expect(afterInserts).toBe(beforeInserts);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CORS SOURCE CHECK
// ═══════════════════════════════════════════════════════════════════

describe('source: no wildcard CORS', () => {
  const checkNoWildcard = (filePath: string) => {
    const src = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    expect(src).not.toMatch(/['"]Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/);
  };

  it('server/cors.ts has no wildcard', () => checkNoWildcard('../server/cors.ts'));
  it('server/auth.ts has no wildcard', () => checkNoWildcard('../server/auth.ts'));
});
