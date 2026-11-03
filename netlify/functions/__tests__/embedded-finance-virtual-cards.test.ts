import fs from 'fs';
import path from 'path';

const SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ALLOWED_ORIGIN = 'https://sub-pro.lanonasis.com';
const FOREIGN_ORIGIN = 'https://evil.example.com';

type Row = Record<string, unknown>;

const mockState = {
  authUser: {
    id: SESSION_USER_ID,
    email: 'owner@example.com',
    user_metadata: {} as Record<string, unknown>,
  },
  authError: null as { message: string; status?: number; code?: string } | null,
  authReturnsNullUser: false,
  authThrows: false,
  tables: {
    virtual_cards: [] as Row[],
    profiles: [] as Row[],
  },
  inserted: [] as Array<{ table: string; row: Row }>,
};

jest.mock('@supabase/supabase-js', () => {
  const createQueryBuilder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let rowLimit: number | undefined;

    const builder: Record<string, unknown> = {};

    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    });
    builder.in = jest.fn((column: string, values: unknown[]) => {
      filters.push([column, values]);
      return builder;
    });
    builder.limit = jest.fn((value: number) => {
      rowLimit = value;
      return builder;
    });
    builder.maybeSingle = jest.fn(async () => {
      const rows = (mockState.tables as Record<string, Row[]>)[table] ?? [];
      const filtered = rows.filter((row) =>
        filters.every(([column, value]) =>
          Array.isArray(value) ? value.includes(row[column]) : row[column] === value,
        ),
      );
      return { data: filtered[0] ?? null, error: null };
    });
    builder.then = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
      const rows = (mockState.tables as Record<string, Row[]>)[table] ?? [];
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

  const authClient = {
    auth: {
      getUser: jest.fn(async (token: string) => {
        if (token === 'valid-token' && mockState.authThrows) {
          throw new Error('network timeout');
        }
        if (token === 'valid-token' && mockState.authError) {
          return { data: { user: null }, error: mockState.authError };
        }
        if (token === 'valid-token' && mockState.authReturnsNullUser) {
          return { data: { user: null }, error: null };
        }
        if (token === 'valid-token') {
          return { data: { user: mockState.authUser }, error: null };
        }

        return { data: { user: null }, error: mockState.authError ?? { message: 'invalid token', status: 401, code: 'invalid_token' } };
      }),
    },
  };

  const serviceClient = {
    from: jest.fn((table: string) => createQueryBuilder(table)),
    auth: { getUser: jest.fn() },
  };

  return {
    createClient: jest.fn((_url: string, key: string) =>
      key === 'service-role-key' ? serviceClient : authClient,
    ),
  };
});

jest.mock('stripe', () => {
  class StripeError extends Error {
    type: string;
    statusCode?: number;

    constructor(message: string, type = 'StripeError', statusCode = 400) {
      super(message);
      this.name = 'StripeError';
      this.type = type;
      this.statusCode = statusCode;
    }
  }

  const mockStripeApi = {
    issuing: {
      cards: {
        list: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      cardholders: { create: jest.fn() },
    },
    customers: {
      search: jest.fn(),
      create: jest.fn(),
    },
  };

  class MockStripe {
    issuing = mockStripeApi.issuing;
    customers = mockStripeApi.customers;
    key: string;
    options?: unknown;

    constructor(key: string, options?: unknown) {
      this.key = key;
      this.options = options;
    }
  }

  (MockStripe as unknown as { errors: unknown }).errors = { StripeError };

  return {
    __esModule: true,
    default: MockStripe,
    __stripeApi: mockStripeApi,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __stripeApi: mockStripeApi } = require('stripe');

type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  path: string;
  queryStringParameters: Record<string, string | undefined>;
};

type HandlerResult = {
  statusCode: number;
  headers?: Record<string, string | undefined>;
  body: string;
};

let handler: (event: HandlerEvent) => Promise<HandlerResult>;

const makeEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
  httpMethod: 'GET',
  headers: {
    origin: ALLOWED_ORIGIN,
    authorization: 'Bearer valid-token',
  },
  body: null,
  path: '/embedded-finance/virtual-cards/list',
  queryStringParameters: {},
  ...overrides,
});

const parseBody = (result: HandlerResult) => JSON.parse(result.body);

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'anon-key';
  process.env.SUPABASE_SECRET_KEY = 'service-role-key';
  process.env.ALLOWED_ORIGINS = `${ALLOWED_ORIGIN},https://subtrack-pro.lanonasis.com`;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  handler = require('../embedded-finance-virtual-cards').handler;
});

beforeEach(() => {
  jest.clearAllMocks();

  mockState.tables.virtual_cards = [];
  mockState.tables.profiles = [];
  mockState.authError = null;
  mockState.authReturnsNullUser = false;
  mockState.authThrows = false;
  mockState.inserted = [];
  mockState.authUser = {
    id: SESSION_USER_ID,
    email: 'owner@example.com',
    user_metadata: {},
  };

  mockStripeApi.issuing.cards.list.mockResolvedValue({ data: [], has_more: false });
  mockStripeApi.issuing.cards.retrieve.mockResolvedValue({
    id: 'ic_mock',
    status: 'active',
    type: 'virtual',
    brand: 'visa',
    last4: '4242',
    exp_month: 12,
    exp_year: 2030,
    currency: 'usd',
    created: 1700000000,
    metadata: { user_id: SESSION_USER_ID },
    spending_controls: {},
  });
  mockStripeApi.issuing.cards.update.mockResolvedValue({
    id: 'ic_mock',
    status: 'inactive',
    last4: '4242',
    spending_controls: {},
    metadata: { user_id: SESSION_USER_ID },
  });
  mockStripeApi.issuing.cards.create.mockResolvedValue({
    id: 'ic_new',
    last4: '4242',
    brand: 'visa',
    status: 'active',
    currency: 'usd',
    created: 1700000000,
    metadata: { user_id: SESSION_USER_ID },
  });
  mockStripeApi.issuing.cardholders.create.mockResolvedValue({ id: 'ch_1' });
  mockStripeApi.customers.search.mockResolvedValue({ data: [] });
  mockStripeApi.customers.create.mockResolvedValue({ id: 'cus_1', email: 'owner@example.com' });
});

describe('authentication', () => {
  it('rejects a request without an Authorization header with 401', async () => {
    const result = await handler(makeEvent({ headers: { origin: ALLOWED_ORIGIN } }));

    expect(result.statusCode).toBe(401);
    expect(parseBody(result).error).toMatch(/authentication required/i);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGIN);
  });

  it('rejects a request with an invalid token with 401', async () => {
    const result = await handler(
      makeEvent({
        headers: { origin: ALLOWED_ORIGIN, authorization: 'Bearer not-a-real-token' },
      }),
    );

    expect(result.statusCode).toBe(401);
    expect(parseBody(result).error).toMatch(/invalid or expired session/i);
    expect(mockStripeApi.issuing.cards.list).not.toHaveBeenCalled();
  });

  it('returns 503 when the authentication service is unavailable', async () => {
    mockState.authError = { message: 'network timeout' };
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(503);
    expect(parseBody(result).error).toMatch(/temporarily unavailable/i);
  });

  it('returns 503 when the auth client throws', async () => {
    mockState.authThrows = true;
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(503);
    expect(parseBody(result).error).toMatch(/temporarily unavailable/i);
  });

  it('returns 503 for a null user result without an error object', async () => {
    mockState.authReturnsNullUser = true;
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(503);
    expect(parseBody(result).error).toMatch(/temporarily unavailable/i);
  });

  it('accepts case-insensitive Bearer authorization', async () => {
    const result = await handler(makeEvent({ headers: { origin: ALLOWED_ORIGIN, authorization: 'bEaReR valid-token' } }));
    expect(result.statusCode).toBe(200);
  });

  it('rejects a request with a malformed Authorization header with 401', async () => {
    const result = await handler(
      makeEvent({ headers: { origin: ALLOWED_ORIGIN, authorization: SESSION_USER_ID } }),
    );

    expect(result.statusCode).toBe(401);
  });

  it('never answers with a wildcard CORS origin', async () => {
    const result = await handler(makeEvent({ headers: { origin: ALLOWED_ORIGIN } }));

    expect(result.headers?.['Access-Control-Allow-Origin']).not.toBe('*');
  });
});

describe('card ownership', () => {
  beforeEach(() => {
    mockState.tables.virtual_cards = [
      { card_id: 'ic_own', user_id: SESSION_USER_ID },
      { card_id: 'ic_other', user_id: OTHER_USER_ID },
    ];
  });

  it('returns 403 for a card that belongs to another user', async () => {
    const result = await handler(
      makeEvent({ path: '/embedded-finance/virtual-cards/ic_other' }),
    );

    expect(result.statusCode).toBe(403);
    expect(mockStripeApi.issuing.cards.retrieve).not.toHaveBeenCalled();
  });

  it('returns 200 for a card that belongs to the signed in user', async () => {
    mockStripeApi.issuing.cards.retrieve.mockResolvedValue({
      id: 'ic_own',
      status: 'active',
      type: 'virtual',
      brand: 'visa',
      last4: '4242',
      currency: 'usd',
      created: 1700000000,
      metadata: { user_id: SESSION_USER_ID },
      spending_controls: {},
    });

    const result = await handler(makeEvent({ path: '/embedded-finance/virtual-cards/ic_own' }));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result).id).toBe('ic_own');
  });

  it('returns 403 when another user tries to update the card', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        path: '/embedded-finance/virtual-cards/ic_other/update',
        body: JSON.stringify({ status: 'canceled' }),
      }),
    );

    expect(result.statusCode).toBe(403);
    expect(mockStripeApi.issuing.cards.update).not.toHaveBeenCalled();
  });

  it('updates a card that belongs to the signed in user', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        path: '/embedded-finance/virtual-cards/ic_own/update',
        body: JSON.stringify({ status: 'inactive' }),
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(mockStripeApi.issuing.cards.update).toHaveBeenCalledWith('ic_own', {
      status: 'inactive',
    });
  });

  it('only lists the cards of the signed in user', async () => {
    mockStripeApi.issuing.cards.list.mockResolvedValue({
      data: [
        { id: 'ic_own', status: 'active', metadata: { user_id: SESSION_USER_ID } },
        { id: 'ic_other', status: 'active', metadata: { user_id: OTHER_USER_ID } },
      ],
      has_more: false,
    });

    const result = await handler(
      makeEvent({
        path: '/embedded-finance/virtual-cards/list',
        queryStringParameters: { userId: OTHER_USER_ID },
      }),
    );

    expect(result.statusCode).toBe(200);

    const body = parseBody(result);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].id).toBe('ic_own');
  });

  it('ignores the user id in the path of the user listing', async () => {
    mockStripeApi.issuing.cards.list.mockResolvedValue({
      data: [{ id: 'ic_own', status: 'active', metadata: { user_id: SESSION_USER_ID } }],
      has_more: false,
    });

    const result = await handler(
      makeEvent({ path: `/embedded-finance/virtual-cards/user/${OTHER_USER_ID}` }),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result).cards).toHaveLength(1);
    expect(parseBody(result).cards[0].id).toBe('ic_own');
  });
});

describe('create', () => {

  it('uses the session user and ignores the user id in the body', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'POST',
        path: '/embedded-finance/virtual-cards/create',
        body: JSON.stringify({
          provider: 'stripe',
          subscriptionId: 'sub_123',
          userId: OTHER_USER_ID,
          userEmail: 'attacker@example.com',
          spendingLimit: 250,
          billingAddress: { line1: '1 Test Street', line2: 'Flat 2', city: 'Lagos', state: 'Lagos', postal_code: '100001', country: 'NG' },
        }),
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result).userId).toBe(SESSION_USER_ID);

    const cardParams = mockStripeApi.issuing.cards.create.mock.calls[0][0];
    expect(cardParams.metadata.user_id).toBe(SESSION_USER_ID);

    const cardholderParams = mockStripeApi.issuing.cardholders.create.mock.calls[0][0];
    expect(cardholderParams.metadata.userId).toBe(SESSION_USER_ID);
    expect(cardholderParams.email).toBe('owner@example.com');
  });

  it('uses the validated billing address from the request', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'POST',
        path: '/embedded-finance/virtual-cards/create',
        body: JSON.stringify({ provider: 'stripe', subscriptionId: 'sub_123', billingAddress: { line1: '1 Test Street', line2: 'Flat 2', city: 'Lagos', state: 'Lagos', postal_code: '100001', country: 'NG' } }),
      }),
    );

    expect(result.statusCode).toBe(200);

    const cardholderParams = mockStripeApi.issuing.cardholders.create.mock.calls[0][0];
    expect(cardholderParams.billing.address).toEqual({
      line1: '1 Test Street',
      line2: 'Flat 2',
      city: 'Lagos',
      state: 'Lagos',
      postal_code: '100001',
      country: 'NG',
    });
    expect(JSON.stringify(cardholderParams)).not.toContain('123 Main St');
  });

  it('returns 400 when the request has no billing address', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'POST',
        path: '/embedded-finance/virtual-cards/create',
        body: JSON.stringify({ provider: 'stripe', subscriptionId: 'sub_123' }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result).error).toMatch(/billing address/i);
    expect(mockStripeApi.issuing.cards.create).not.toHaveBeenCalled();
  });


  it('escapes the values used in the Stripe customer search', async () => {
    mockState.authUser = {
      id: SESSION_USER_ID,
      email: "o'brien@example.com",
      user_metadata: {},
    };

    await handler(
      makeEvent({
        httpMethod: 'POST',
        path: '/embedded-finance/virtual-cards/create',
        body: JSON.stringify({
          provider: 'stripe',
          subscriptionId: 'sub_123',
          userEmail: 'attacker@example.com',
          billingAddress: { line1: '1 Test Street', city: 'Lagos', postal_code: '100001', country: 'NG' },
        }),
      }),
    );

    const searchParams = mockStripeApi.customers.search.mock.calls[0][0];
    expect(searchParams.query).toContain("email:'o\\'brien@example.com'");
    expect(searchParams.query).toContain(`metadata['userId']:'${SESSION_USER_ID}'`);
    expect(searchParams.query).not.toContain('attacker@example.com');
  });

  it('rejects an invalid spending limit', async () => {
    const result = await handler(
      makeEvent({
        httpMethod: 'POST',
        path: '/embedded-finance/virtual-cards/create',
        body: JSON.stringify({
          provider: 'stripe',
          subscriptionId: 'sub_123',
          spendingLimit: -5,
          billingAddress: { line1: '1 Test Street', city: 'Lagos', postal_code: '100001', country: 'NG' },
        }),
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(mockStripeApi.issuing.cards.create).not.toHaveBeenCalled();
  });

  it('omits phone_number when no phone is provided', async () => {
    await handler(makeEvent({ httpMethod: 'POST', path: '/embedded-finance/virtual-cards/create', body: JSON.stringify({ provider: 'stripe', subscriptionId: 'sub_123', billingAddress: { line1: '1 Test Street', city: 'Lagos', postal_code: '100001', country: 'NG' } }) }));
    expect(mockStripeApi.issuing.cardholders.create.mock.calls[0][0]).not.toHaveProperty('phone_number');
  });
});

describe('cors', () => {
  it('answers a preflight from an allowed origin', async () => {
    const result = await handler(
      makeEvent({ httpMethod: 'OPTIONS', headers: { origin: ALLOWED_ORIGIN } }),
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGIN);
  });

  it('rejects a preflight from an unknown origin', async () => {
    const result = await handler(
      makeEvent({ httpMethod: 'OPTIONS', headers: { origin: FOREIGN_ORIGIN } }),
    );

    expect(result.statusCode).toBe(403);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('rejects a request from an unknown origin', async () => {
    const result = await handler(
      makeEvent({ headers: { origin: FOREIGN_ORIGIN, authorization: 'Bearer valid-token' } }),
    );

    expect(result.statusCode).toBe(403);
    expect(mockStripeApi.issuing.cards.list).not.toHaveBeenCalled();
  });

  it('allows a request without an origin header (mobile or server to server)', async () => {
    const result = await handler(makeEvent({ headers: { authorization: 'Bearer valid-token' } }));

    expect(result.statusCode).not.toBe(403);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('source of the function', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'embedded-finance-virtual-cards.ts'),
    'utf8',
  );

  it('has no wildcard CORS header', () => {
    expect(source).not.toMatch(/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*/);
  });

  it('has no hardcoded billing address', () => {
    expect(source).not.toContain('123 Main St');
  });
});
