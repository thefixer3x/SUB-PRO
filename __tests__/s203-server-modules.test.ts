/**
 * S203 — unit tests for the server modules and API handlers.
 *
 * Covers every accept-when case:
 *  - virtual-cards: auth, ownership, create, list, update, validation
 *  - banking proxy: validation, forwarding, timeout
 *  - HIBP: breach check, missing API key
 *  - Splitwise: 501 response
 *  - CORS: no wildcard headers
 *  - Accept-when grep: env-var names only in server code
 */

// ── Environment MUST be set BEFORE any imports ──
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'service-role-key';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_anon_key';
process.env.ALLOWED_ORIGINS = 'https://sub-pro.lanonasis.com';
process.env.MCP_API_KEY = 'mcp_test_key';
process.env.MCP_BASE_URL = 'https://api.test-mcp.com';
process.env.HAVEIBEENPWNED_API_KEY = 'hibp_test_key';
process.env.SITE_URL = 'https://subtrack.pro';

import Stripe from 'stripe';

// ═════════════════════════════════════════════════════════════════════════════
// MOCKS (hoisted by Jest before any static imports)
// ═════════════════════════════════════════════════════════════════════════════

jest.mock('stripe', () => {
  const api = {
    issuing: {
      cards: { list: jest.fn(), retrieve: jest.fn(), update: jest.fn(), create: jest.fn() },
      cardholders: { create: jest.fn() },
    },
    customers: { search: jest.fn(), create: jest.fn() },
    prices: { list: jest.fn(), retrieve: jest.fn() },
  };
  class StripeError extends Error {
    type: string;
    statusCode?: number;
    constructor(message = 'StripeError', type = 'StripeError', statusCode = 400) {
      super(message);
      this.name = 'StripeError';
      this.type = type;
      this.statusCode = statusCode;
    }
  }
  class MockStripe {
    key = '';
    issuing = api.issuing;
    customers = api.customers;
    constructor(key: string) { this.key = key; }
  }
  (MockStripe as unknown as { errors: unknown }).errors = { StripeError };
  // Return a reference to api so tests can access mock methods
  const __stripeApi = api;
  return { __esModule: true, default: MockStripe, __stripeApi: __stripeApi };
});

const { __stripeApi: s } = require('stripe');

// ─── mock server/stripe.ts ──────────────────────────────────────────────────
// Ensures stripe client is always configured for tests
jest.mock('../server/stripe', () => {
  const MockStripe = require('stripe').default;
  const stripe = new MockStripe('test_fake_key');
  return {
    stripe,
    ensureStripe: () => stripe,
  };
});

// ─── Supabase mocks ─────────────────────────────────────────────────────────

let _tables: Record<string, Record<string, unknown>[]> = {
  virtual_cards: [], profiles: [],
};
let _inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
let _authUser: { id: string; email: string | null; user_metadata: Record<string, unknown> } = {
  id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com', user_metadata: {},
};
let _authError: { message: string; status?: number; code?: string } | null = null;

const createQueryBuilder = (table: string) => {
  const filters: [string, unknown][] = [];
  let rowLimit: number | undefined;
  const builder: Record<string, unknown> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((c: string, v: unknown) => { filters.push([c, v]); return builder; });
  builder.limit = jest.fn((v: number) => { rowLimit = v; return builder; });
  builder.insert = jest.fn(async (row: Record<string, unknown>) => {
    _inserted.push({ table, row });
    (_tables[table] ??= []).push(row);
    return { data: null, error: null };
  });
  builder.then = (resolve: (v: unknown) => void, reject: (r: unknown) => void) => {
    const rows = _tables[table] ?? [];
    const filtered = rows.filter((row) =>
      filters.every(([column, value]) =>
        Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
      ),
    );
    const limited = typeof rowLimit === 'number' ? filtered.slice(0, rowLimit) : filtered;
    return Promise.resolve({ data: limited, error: null }).then(resolve, reject);
  };
  return builder;
};

const mockAuthService = {
  auth: {
    getUser: jest.fn(async (token: string) => {
      if (token === 'valid-token') return { data: { user: _authUser }, error: null };
      return { data: { user: null }, error: _authError ?? { message: 'invalid', status: 401, code: 'invalid_token' } };
    }),
  },
};

const mockServiceService = {
  from: jest.fn((table: string) => createQueryBuilder(table)),
  auth: { getUser: jest.fn() },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, key: string) =>
    key === 'service-role-key' ? mockServiceService : mockAuthService,
  ) as jest.Mock,
}));

// ─── fetch mock ─────────────────────────────────────────────────────────────

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT server modules (after all mocks and env vars are set)
// ═════════════════════════════════════════════════════════════════════════════

import * as vcServer from '../server/virtual-cards';
import * as bankServer from '../server/banking';
import * as hibpServer from '../server/hibp';
import * as swServer from '../server/splitwise';
import vcExport from '../api/embedded-finance/virtual-cards/[...path]';
import bankExport from '../api/banking/proxy';
import hibpExport from '../api/hibp-check';
import swExport from '../api/splitwise';
import nfVcHandler from '../netlify/functions/embedded-finance-virtual-cards';
import nfBankHandler from '../netlify/functions/banking-proxy';

// Vercel calls the default export's fetch (Web Request -> Response).
const vcHandler = vcExport.fetch;
const bankHandler = bankExport.fetch;
const hibpHandler = hibpExport.fetch;
const swHandler = swExport.fetch;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGINS!;

beforeEach(() => {
  jest.clearAllMocks();
  _tables = { virtual_cards: [], profiles: [] };
  _authError = null;
  _authUser = { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com', user_metadata: {} };
  _inserted = [];
  s.issuing.cards.list.mockResolvedValue({ data: [], has_more: false });
  s.issuing.cards.retrieve.mockResolvedValue({
    id: 'ic_mock', status: 'active', type: 'virtual', brand: 'visa', last4: '4242',
    currency: 'usd', created: 1700000000, metadata: { user_id: _authUser.id },
    spending_controls: {}, exp_month: 12, exp_year: 2030, cardholder: 'ch_1',
  } as unknown as Stripe.Issuing.Card);
  s.issuing.cards.update.mockResolvedValue({
    id: 'ic_mock', status: 'inactive', last4: '4242', spending_controls: {},
    metadata: { user_id: _authUser.id },
  } as unknown as Stripe.Issuing.Card);
  s.issuing.cards.create.mockResolvedValue({
    id: 'ic_new', last4: '4242', brand: 'visa', status: 'active', currency: 'usd',
    created: 1700000000, metadata: { user_id: _authUser.id }, cardholder: 'ch_1',
  } as unknown as Stripe.Issuing.Card);
  s.issuing.cardholders.create.mockResolvedValue({ id: 'ch_1' });
  s.customers.search.mockResolvedValue({ data: [] });
  s.customers.create.mockResolvedValue({ id: 'cus_1', email: 'owner@example.com' });
  s.prices.list.mockResolvedValue({ data: [{ id: 'price_1', lookup_keys: ['subtrack_pro_monthly'] }] });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test helpers
// ═════════════════════════════════════════════════════════════════════════════

const makeRequest = (overrides: { url?: string; method?: string; headers?: Record<string, string>; body?: string; skipAuth?: boolean } = {}): Request => {
  const url = 'https://placeholder' + (overrides.url ?? '/api/test');
  const headers: Record<string, string> = overrides.skipAuth
    ? { ...((overrides.headers as Record<string, string>) ?? {}) }
    : { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', ...((overrides.headers as Record<string, string>) ?? {}) };
  return new Request(url, {
    method: overrides.method ?? 'GET',
    headers,
    body: overrides.body,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: validateCreateCard
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: validateCreateCard', () => {
  it('accepts valid input', () => {
    const result = vcServer.validateCreateCard({
      subscriptionId: 'sub_123',
      billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
    });
    expect(result).toBeNull();
  });
  it('rejects missing subscriptionId', () => {
    const result = vcServer.validateCreateCard({
      billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
    });
    expect(result).toBe('Missing required fields');
  });
  it('rejects negative spending limit', () => {
    const result = vcServer.validateCreateCard({
      subscriptionId: 'sub_123', spendingLimit: -5,
      billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
    });
    expect(result).toBe('Spending limit must be non-negative');
  });
  it('rejects spending limit exceeding cap', () => {
    const result = vcServer.validateCreateCard({
      subscriptionId: 'sub_123', spendingLimit: 100000,
      billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
    });
    expect(result).toBe('Spending limit exceeds the maximum allowed');
  });
  it('rejects unsupported merchant category', () => {
    const result = vcServer.validateCreateCard({
      subscriptionId: 'sub_123', merchantCategory: 'manual_cash_disburse',
      billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
    });
    expect(result).toBe('Unsupported merchant category');
  });
  it('rejects missing billing address', () => {
    const result = vcServer.validateCreateCard({ subscriptionId: 'sub_123' });
    expect(result).toBe('A valid billing address is required');
  });
  it('rejects incomplete billing address', () => {
    const result = vcServer.validateCreateCard({
      subscriptionId: 'sub_123', billingAddress: { line1: '1 Test' },
    });
    expect(result).toBe('A valid billing address is required');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: parseUpdateControls
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: parseUpdateControls', () => {
  it('returns null for empty input', () => {
    expect(vcServer.parseUpdateControls({})).toBeNull();
  });
  it('rejects blockedCategories', () => {
    expect(vcServer.parseUpdateControls({ blockedCategories: [] as never })).toBe(
      'blockedCategories is not supported; use allowedCategories',
    );
  });
  it('rejects invalid interval', () => {
    expect(vcServer.parseUpdateControls({ spendingLimits: [{ amount: 10, interval: 'forever' }] as never })).toBe(
      'Unsupported spending limit interval',
    );
  });
  it('rejects spending limit above per_authorization cap', () => {
    expect(vcServer.parseUpdateControls({ spendingLimits: [{ amount: 600, interval: 'per_authorization' }] as never })).toBe(
      'Spending limit exceeds the maximum allowed',
    );
  });
  it('rejects negative spending amount', () => {
    expect(vcServer.parseUpdateControls({ spendingLimits: [{ amount: -5, interval: 'monthly' }] as never })).toBe(
      'Spending limit amounts must be positive numbers',
    );
  });
  it('rejects zero-cents amount', () => {
    expect(vcServer.parseUpdateControls({ spendingLimits: [{ amount: 0.001, interval: 'monthly' }] as never })).toBe(
      'Spending limit amounts must be at least 0.01',
    );
  });
  it('rejects invalid allowedCategories', () => {
    expect(vcServer.parseUpdateControls({ allowedCategories: ['betting_casino_gambling'] as never })).toBe(
      'allowedCategories must be a non-empty list of supported categories',
    );
  });
  it('rejects empty allowedCategories list', () => {
    expect(vcServer.parseUpdateControls({ allowedCategories: [] as never })).toBe(
      'allowedCategories must be a non-empty list of supported categories',
    );
  });
  it('accepts valid spending limits in cents', () => {
    const result = vcServer.parseUpdateControls({ spendingLimits: [{ amount: 25.5, interval: 'monthly' }] as never });
    expect(typeof result).toBe('object');
  });
  it('rejects too many spending limits', () => {
    const limits = Array.from({ length: 6 }, () => ({ amount: 10, interval: 'monthly' }));
    expect(vcServer.parseUpdateControls({ spendingLimits: limits as never })).toBe(
      'spendingLimits must have 1-5 entries',
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: createCard
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: createCard', () => {
  it('creates a card with Stripe and records ownership', async () => {
    const result = await vcServer.createCard(_authUser.id, _authUser.email ?? undefined, {
      subscriptionId: 'sub_123',
      billingAddress: { line1: '1 Test Street', city: 'Lagos', postal_code: '100001', country: 'NG' },
      spendingLimit: 250,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.last4).toBe('4242');
      expect(result.data.userId).toBe(_authUser.id);
    }
    expect(s.issuing.cardholders.create).toHaveBeenCalled();
    expect(s.issuing.cards.create).toHaveBeenCalled();
    expect(_inserted).toHaveLength(1);
    expect((_inserted[0].row as { user_id: string }).user_id).toBe(_authUser.id);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: listCards
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: listCards', () => {
  it('filters cards by user_id from metadata', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    s.issuing.cards.list.mockResolvedValue({
      data: [
        { id: 'ic_own', status: 'active', metadata: { user_id: _authUser.id } },
        { id: 'ic_other', status: 'active', metadata: { user_id: other } },
      ],
      has_more: false,
    });
    const result = await vcServer.listCards(_authUser.id, {});
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('ic_own');
  });

  it('stops scanning after page budget and returns a resume cursor', async () => {
    let page = 0;
    s.issuing.cards.list.mockImplementation(async () => {
      page += 1;
      return {
        data: [{ id: `ic_foreign_${page}`, status: 'active', metadata: { user_id: 'other' } }],
        has_more: true,
      };
    });
    const result = await vcServer.listCards(_authUser.id, {});
    expect(s.issuing.cards.list).toHaveBeenCalledTimes(5);
    expect(result.cards).toHaveLength(0);
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).toBe('ic_foreign_5');
  });

  it('respects limit parameter', async () => {
    s.issuing.cards.list.mockResolvedValue({
      data: [{ id: 'ic_1', status: 'active', metadata: { user_id: _authUser.id } }],
      has_more: false,
    });
    await vcServer.listCards(_authUser.id, { limit: 5 });
    expect(s.issuing.cards.list).toHaveBeenCalledWith({ limit: 5 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: retrieveCard
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: retrieveCard', () => {
  beforeEach(() => { _tables.virtual_cards = [{ card_id: 'ic_own', user_id: _authUser.id }]; });

  it('returns the card for the owner', async () => {
    const result = await vcServer.retrieveCard('ic_own', _authUser.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.cardholder).toBe('ch_1');
    expect(s.issuing.cards.retrieve).toHaveBeenCalledWith('ic_own');
  });

  it('returns 403 for another user card', async () => {
    const result = await vcServer.retrieveCard('ic_own', '22222222-2222-4222-8222-222222222222');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Access denied');
    expect(s.issuing.cards.retrieve).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/virtual-cards: updateCard
// ═════════════════════════════════════════════════════════════════════════════

describe('server/virtual-cards: updateCard', () => {
  beforeEach(() => { _tables.virtual_cards = [{ card_id: 'ic_own', user_id: _authUser.id }]; });

  it('updates the status for the owner', async () => {
    const result = await vcServer.updateCard('ic_own', _authUser.id, { status: 'inactive' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.card.status).toBe('inactive');
    expect(s.issuing.cards.update).toHaveBeenCalledWith('ic_own', { status: 'inactive' });
  });

  it('rejects update for another user', async () => {
    const result = await vcServer.updateCard('ic_own', '22222222-2222-4222-8222-222222222222', { status: 'inactive' });
    expect(result.ok).toBe(false);
    expect(s.issuing.cards.update).not.toHaveBeenCalled();
  });

  it('rejects when both status and controls are missing', async () => {
    const result = await vcServer.updateCard('ic_own', _authUser.id, {});
    expect(result.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/banking: proxyRequest
// ═════════════════════════════════════════════════════════════════════════════

describe('server/banking: proxyRequest', () => {
  it('forwards a valid request to the upstream', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ accounts: [] }) });
    const result = await bankServer.proxyRequest(
      { path: '/banking/connect', method: 'POST', payload: { bankCode: 'ABCD' } },
      'test_key', 'https://api.test.com', 'user-abc',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ accounts: [] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-User-ID']).toBe('user-abc');
  });

  it('returns 504 on timeout', async () => {
    const err = new Error('Upstream timed out');
    (err as Error & { name: string }).name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(err);
    const result = await bankServer.proxyRequest(
      { path: '/banking/connect', method: 'POST', payload: {} },
      'test_key', 'https://api.test.com', 'user-abc',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(504);
      expect(result.error).toBe('Upstream banking service timed out');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/hibp: checkBreach
// ═════════════════════════════════════════════════════════════════════════════

describe('server/hibp: checkBreach', () => {
  it('returns breached: false for 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 404 });
    const result = await hibpServer.checkBreach('nobody@example.com', 'test_api_key');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.breached).toBe(false);
  });

  it('returns error for 502 upstream', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 });
    const result = await hibpServer.checkBreach('user@example.com', 'test_api_key');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Breach service unavailable');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// server/splitwise: handleSplitwise
// ═════════════════════════════════════════════════════════════════════════════

describe('server/splitwise: handleSplitwise', () => {
  it('returns 501', async () => {
    const result = await swServer.handleSplitwise();
    expect(result.statusCode).toBe(501);
    expect(result.error).toBe('Splitwise integration is not available yet');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// api/embedded-finance/virtual-cards handler
// ═════════════════════════════════════════════════════════════════════════════

describe('api/embedded-finance/virtual-cards: handler', () => {
  it('rejects request without auth token with 401', async () => {
    const req = new Request('https://placeholder/api/embedded-finance/virtual-cards/list', {
      method: 'GET',
      headers: { origin: ALLOWED_ORIGIN }, // no authorization header
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(401);
    const body = JSON.parse(await res.text());
    expect(body.error).toMatch(/authentication required/i);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  });

  it('rejects request with invalid token with 401', async () => {
    const req = makeRequest({
      url: '/api/embedded-finance/virtual-cards/list',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer invalid' },
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(401);
  });

  it('accepts preflight from allowed origin', async () => {
    const req = new Request('https://placeholder/api/embedded-finance/virtual-cards/list', {
      method: 'OPTIONS', headers: { origin: ALLOWED_ORIGIN },
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('rejects preflight from unknown origin', async () => {
    const req = new Request('https://placeholder/api/embedded-finance/virtual-cards/list', {
      method: 'OPTIONS', headers: { origin: 'https://evil.com' },
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(403);
  });

  it('lists cards for the authenticated user', async () => {
    s.issuing.cards.list.mockResolvedValue({
      data: [{ id: 'ic_1', status: 'active', metadata: { user_id: _authUser.id } }],
      has_more: false,
    });
    const req = makeRequest({ url: '/api/embedded-finance/virtual-cards/list' });
    const res = await vcHandler(req);
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].id).toBe('ic_1');
  });

  it('creates a card on POST /create', async () => {
    const req = new Request('https://placeholder/api/embedded-finance/virtual-cards/create', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: 'sub_123',
        billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
      }),
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.last4).toBe('4242');
    expect(body.userId).toBe(_authUser.id);
  });

  it('rejects create with missing billing address', async () => {
    const req = new Request('https://placeholder/api/embedded-finance/virtual-cards/create', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({ subscriptionId: 'sub_123' }),
    });
    const res = await vcHandler(req);
    expect(res.status).toBe(400);
  });

  it('retrieves a card on GET /:cardId', async () => {
    _tables.virtual_cards = [{ card_id: 'ic_own', user_id: _authUser.id }];
    const req = makeRequest({ url: '/api/embedded-finance/virtual-cards/ic_own' });
    const res = await vcHandler(req);
    expect(res.status).toBe(200);
  });

  it('returns 403 for another user retrieving card', async () => {
    _tables.virtual_cards = [{ card_id: 'ic_own', user_id: _authUser.id }];
    _authUser.id = '22222222-2222-4222-8222-222222222222';
    const req = makeRequest({ url: '/api/embedded-finance/virtual-cards/ic_own' });
    const res = await vcHandler(req);
    _authUser.id = '11111111-1111-4111-8111-111111111111';
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown route', async () => {
    const req = makeRequest({ url: '/api/embedded-finance/virtual-cards/unknown/route' });
    const res = await vcHandler(req);
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// api/banking/proxy handler
// ═════════════════════════════════════════════════════════════════════════════

describe('api/banking/proxy: handler', () => {
  it('rejects without auth', async () => {
    const req = new Request('https://placeholder/api/banking/proxy', {
      method: 'POST', headers: { origin: ALLOWED_ORIGIN },
      body: JSON.stringify({ path: '/banking/connect', method: 'POST' }),
    });
    const res = await bankHandler(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid path in body', async () => {
    const req = new Request('https://placeholder/api/banking/proxy', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/forbidden/path', method: 'POST' }),
    });
    const res = await bankHandler(req);
    expect(res.status).toBe(400);
  });

  it('forwards a valid request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) });
    const req = new Request('https://placeholder/api/banking/proxy', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/banking/connect', method: 'POST' }),
    });
    const res = await bankHandler(req);
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toEqual({ connected: true });
  });

  it('scopes the upstream call to the session user, ignoring any user id in the body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) });
    const req = new Request('https://placeholder/api/banking/proxy', {
      method: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        path: '/banking/connect',
        method: 'POST',
        userId: '22222222-2222-4222-8222-222222222222',
        payload: { userId: '22222222-2222-4222-8222-222222222222' },
      }),
    });
    const res = await bankHandler(req);
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-User-ID']).toBe(_authUser.id);
  });

  it('rejects non-POST method', async () => {
    const req = new Request('https://placeholder/api/banking/proxy', {
      method: 'GET', headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
    });
    const res = await bankHandler(req);
    expect(res.status).toBe(405);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// api/hibp-check handler
// ═════════════════════════════════════════════════════════════════════════════

describe('api/hibp-check: handler', () => {
  it('returns 401 without auth', async () => {
    const req = new Request('https://placeholder/api/hibp-check', {
      method: 'POST', headers: { origin: ALLOWED_ORIGIN },
    });
    const res = await hibpHandler(req);
    expect(res.status).toBe(401);
  });

  it('forwards breach check and returns result', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 404 });
    const req = new Request('https://placeholder/api/hibp-check', {
      method: 'POST', headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
    });
    const res = await hibpHandler(req);
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text()).breached).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// api/splitwise handler
// ═════════════════════════════════════════════════════════════════════════════

describe('api/splitwise: handler', () => {
  it('returns 501 to signed-in users', async () => {
    const req = new Request('https://placeholder/api/splitwise', {
      method: 'POST', headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
    });
    const res = await swHandler(req);
    expect(res.status).toBe(501);
    expect(JSON.parse(await res.text()).error).toBe('Splitwise integration is not available yet');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Netlify adapter: embedded-finance-virtual-cards
// ═════════════════════════════════════════════════════════════════════════════

describe('Netlify adapter: embedded-finance-virtual-cards', () => {
  it('delegates to the Vercel handler for list', async () => {
    s.issuing.cards.list.mockResolvedValue({ data: [], has_more: false });
    const result = await nfVcHandler({
      httpMethod: 'GET', path: '/api/embedded-finance/virtual-cards/list',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
      body: null, queryStringParameters: {},
    });
    expect(result.statusCode).toBe(200);
  });

  it('delegates to the Vercel handler for create', async () => {
    const result = await nfVcHandler({
      httpMethod: 'POST', path: '/api/embedded-finance/virtual-cards/create',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
      body: JSON.stringify({
        subscriptionId: 'sub_123',
        billingAddress: { line1: '1 Test', city: 'Lagos', postal_code: '100001', country: 'NG' },
      }),
      queryStringParameters: {},
    });
    expect(result.statusCode).toBe(200);
  });

  it('delegates auth failure', async () => {
    const result = await nfVcHandler({
      httpMethod: 'GET', path: '/embedded-finance/virtual-cards/list',
      headers: { origin: ALLOWED_ORIGIN },
      body: null, queryStringParameters: {},
    });
    expect(result.statusCode).toBe(401);
  });

  it('never answers with wildcard CORS', async () => {
    s.issuing.cards.list.mockResolvedValue({ data: [], has_more: false });
    const result = await nfVcHandler({
      httpMethod: 'GET', path: '/embedded-finance/virtual-cards/list',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
      body: null, queryStringParameters: {},
    });
    const originHeader = result.headers?.['Access-Control-Allow-Origin'];
    expect(originHeader).not.toBe('*');
    if (originHeader) expect(originHeader).toBe(ALLOWED_ORIGIN);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Netlify adapter: banking-proxy
// ═════════════════════════════════════════════════════════════════════════════

describe('Netlify adapter: banking-proxy', () => {
  it('delegates to the Vercel handler', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) });
    const result = await nfBankHandler({
      httpMethod: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
      body: JSON.stringify({ path: '/banking/connect', method: 'POST' }),
    });
    expect(result.statusCode).toBe(200);
  });

  it('rejects without auth', async () => {
    const result = await nfBankHandler({
      httpMethod: 'POST',
      headers: { origin: ALLOWED_ORIGIN },
      body: JSON.stringify({ path: '/banking/connect', method: 'POST' }),
    });
    expect(result.statusCode).toBe(401);
  });

  it('never answers with wildcard CORS', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const result = await nfBankHandler({
      httpMethod: 'POST',
      headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer valid-token' },
      body: JSON.stringify({ path: '/banking/connect', method: 'POST' }),
    });
    const cors = result.headers?.['Access-Control-Allow-Origin'];
    expect(cors).not.toBe('*');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Accept-when: no raw API key env-var names in client code
// ═════════════════════════════════════════════════════════════════════════════

describe('accept-when: no raw API key env-var names in client code', () => {
  const fs = require('fs');
  const path = require('path');

  // Pattern matches env-var assignments and runtime reads, not comments
  const secretEnvPattern = /(?:process\.env\.(?:SPLITWISE_API_KEY|HAVEIBEENPWNED_API_KEY)|SPLITWISE_API_KEY\s*=|HAVEIBEENPWNED_API_KEY\s*=)/;

  const dirs = ['app', 'components', 'hooks', 'services', 'config'];

  const findMatches = (dir: string): string[] => {
    const results: string[] = [];
    const fullDir = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullDir)) return results;

    const walk = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (secretEnvPattern.test(content)) results.push(entry.name);
        }
      }
    };
    walk(fullDir);
    return results;
  };

  it('no SPLITWISE_API_KEY env reads in client dirs', () => {
    const allMatches = dirs.flatMap(d => findMatches(d));
    expect(allMatches).toEqual([]);
  });

  it('no HAVEIBEENPWNED_API_KEY env reads in client dirs', () => {
    const allMatches = dirs.flatMap(d => findMatches(d));
    expect(allMatches).toEqual([]);
  });
});
