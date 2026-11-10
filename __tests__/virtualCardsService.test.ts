/**
 * The card service sends the user's token, uses the real API routes, and
 * keeps only display-safe card fields whatever the server returns.
 */
const mockFetch = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-123' } } }) },
  },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

// eslint-disable-next-line import/first
import { virtualCardService, toCardSummary } from '@/services/virtualCards';

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

beforeAll(() => {
  (global as unknown as { window: object }).window = {};
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => mockFetch.mockReset());

describe('virtual card service', () => {
  it('drops everything but display-safe fields', () => {
    const card = toCardSummary({
      id: 'ic_1',
      last4: '4242',
      brand: 'visa',
      status: 'active',
      exp_month: 1,
      exp_year: 2030,
      // Would never come from our API, but must not survive if it did.
      ...({ number: '4000009990000000', cvc: '123' } as object),
    });
    expect(card).toEqual({
      id: 'ic_1',
      last4: '4242',
      brand: 'visa',
      status: 'active',
      expMonth: 1,
      expYear: 2030,
      currency: undefined,
      subscriptionId: undefined,
    });
    expect(JSON.stringify(card)).not.toMatch(/4000009990000000|"cvc"/);
  });

  it('lists cards from /list with the bearer token', async () => {
    mockFetch.mockResolvedValue(ok({ cards: [{ id: 'ic_1', last4: '4242', brand: 'visa', status: 'active' }], has_more: false }));
    const result = await virtualCardService.listCards();
    expect(result.cards).toHaveLength(1);
    expect(result.complete).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/embedded-finance/virtual-cards/list?limit=100');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
  });

  it('follows next_cursor past empty pages until the list is done', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ cards: [], has_more: true, next_cursor: 'ic_scan_1' }))
      .mockResolvedValueOnce(ok({ cards: [{ id: 'ic_2', last4: '0002', brand: 'visa', status: 'active' }], has_more: false, next_cursor: null }));
    const result = await virtualCardService.listCards();
    expect(result).toMatchObject({ complete: true });
    expect(result.cards.map((c) => c.id)).toEqual(['ic_2']);
    expect(mockFetch.mock.calls[1][0]).toBe('/api/embedded-finance/virtual-cards/list?limit=100&starting_after=ic_scan_1');
  });

  it('reports an incomplete list when the request budget runs out', async () => {
    let n = 0;
    mockFetch.mockImplementation(async () => ok({ cards: [], has_more: true, next_cursor: `ic_${(n += 1)}` }));
    const result = await virtualCardService.listCards();
    expect(result).toEqual({ cards: [], complete: false });
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });

  it('freezes through PATCH /:id/update with status inactive', async () => {
    mockFetch.mockResolvedValue(ok({ success: true }));
    await virtualCardService.setCardLocked('ic_1', true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/embedded-finance/virtual-cards/ic_1/update');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'inactive' });
  });

  it('asks for a reveal key with the nonce and Stripe version only', async () => {
    mockFetch.mockResolvedValue(ok({ secret: 'ek_test', expires: 1 }));
    const key = await virtualCardService.createRevealKey('ic_1', 'ephkn_pub_x', '2025-08-27.basil');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/embedded-finance/virtual-cards/ic_1/ephemeral-key');
    expect(JSON.parse(init.body as string)).toEqual({ nonce: 'ephkn_pub_x', stripeVersion: '2025-08-27.basil' });
    expect(key).toEqual({ secret: 'ek_test', expires: 1 });
  });
});
