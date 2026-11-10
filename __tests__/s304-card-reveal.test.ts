/* eslint-env node */
/**
 * S304: the reveal key is created only for the caller's own card, with the
 * card id and nonce only, and the API never returns a card number or CVC.
 * Transactions come from card_authorizations for the caller's own card.
 */
const mockEphemeralCreate = jest.fn();
const mockCardRetrieve = jest.fn();
jest.mock('../server/stripe', () => ({
  ensureStripe: () => ({
    ephemeralKeys: { create: (...a: unknown[]) => mockEphemeralCreate(...a) },
    issuing: { cards: { retrieve: (...a: unknown[]) => mockCardRetrieve(...a) } },
  }),
}));

// card_id -> owner, as stored in virtual_cards.
let mockOwners: Record<string, string> = {};
let mockAuthRows: Array<Record<string, unknown>> = [];
const mockAuthQuery = jest.fn();

jest.mock('../server/supabase-admin', () => ({
  createSupabaseAdmin: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (col: string, val: unknown) => {
        filters[col] = val;
        return q;
      };
      q.order = () => q;
      q.limit = async (n: number) => {
        if (table === 'virtual_cards') {
          const owner = mockOwners[filters.card_id as string];
          return { data: owner && owner === filters.user_id ? [{ card_id: filters.card_id }] : [] };
        }
        mockAuthQuery({ table, filters, limit: n });
        return { data: mockAuthRows, error: null };
      };
      return q;
    },
  }),
}));

// eslint-disable-next-line import/first
import { createCardEphemeralKey, listCardTransactions } from '../server/virtual-cards';

const NONCE = 'ephkn_pub_abcdefgh12345678';
const VERSION = '2025-08-27.basil';

beforeEach(() => {
  mockOwners = { ic_mine: 'user-a', ic_theirs: 'user-b' };
  mockAuthRows = [];
  mockEphemeralCreate.mockReset().mockResolvedValue({
    id: 'ephkey_1',
    secret: 'ek_test_secret',
    expires: 1_900_000_000,
    associated_objects: [{ type: 'issuing.card', id: 'ic_mine' }],
  });
  mockCardRetrieve.mockReset().mockImplementation(async (id: string) => ({
    id,
    metadata: { user_id: mockOwners[id] },
    // Present on the Stripe object; must never be passed through.
    number: '4000009990000000',
    cvc: '123',
  }));
  mockAuthQuery.mockReset();
});

describe('ephemeral key for Issuing Elements', () => {
  it("refuses another user's card with 403 and never calls Stripe", async () => {
    const r = await createCardEphemeralKey('ic_theirs', 'user-a', { nonce: NONCE, stripeVersion: VERSION });
    expect(r).toEqual({ ok: false, error: 'Access denied', status: 403 });
    expect(mockEphemeralCreate).not.toHaveBeenCalled();
  });

  it('refuses when the Stripe card metadata names someone else', async () => {
    mockCardRetrieve.mockResolvedValue({ id: 'ic_mine', metadata: { user_id: 'user-b' } });
    const r = await createCardEphemeralKey('ic_mine', 'user-a', { nonce: NONCE, stripeVersion: VERSION });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(mockEphemeralCreate).not.toHaveBeenCalled();
  });

  it('creates the key for one owned card with the card id and nonce only', async () => {
    const r = await createCardEphemeralKey('ic_mine', 'user-a', { nonce: NONCE, stripeVersion: VERSION });
    expect(mockEphemeralCreate).toHaveBeenCalledWith(
      { issuing_card: 'ic_mine', nonce: NONCE },
      { apiVersion: VERSION },
    );
    expect(r).toEqual({ ok: true, data: { secret: 'ek_test_secret', expires: 1_900_000_000 } });
  });

  it('returns no card number or CVC', async () => {
    const r = await createCardEphemeralKey('ic_mine', 'user-a', { nonce: NONCE, stripeVersion: VERSION });
    const body = JSON.stringify(r);
    expect(body).not.toMatch(/4000009990000000/);
    expect(body).not.toMatch(/"cvc"|"number"/);
  });

  it.each([
    [{ nonce: 'nope', stripeVersion: VERSION }, 'Invalid nonce'],
    [{ nonce: 42, stripeVersion: VERSION }, 'Invalid nonce'],
    [{ nonce: NONCE, stripeVersion: 'latest' }, 'Invalid Stripe version'],
  ])('rejects malformed input %j', async (input, error) => {
    const r = await createCardEphemeralKey('ic_mine', 'user-a', input);
    expect(r).toEqual({ ok: false, error, status: 400 });
    expect(mockCardRetrieve).not.toHaveBeenCalled();
  });

  it('hides Stripe error details behind a generic 502', async () => {
    mockEphemeralCreate.mockRejectedValue(new Error('raw stripe failure'));
    const r = await createCardEphemeralKey('ic_mine', 'user-a', { nonce: NONCE, stripeVersion: VERSION });
    expect(r).toEqual({ ok: false, error: 'Could not create a reveal key', status: 502 });
  });
});

describe('card transactions', () => {
  it("refuses another user's card", async () => {
    const r = await listCardTransactions('ic_theirs', 'user-a');
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(mockAuthQuery).not.toHaveBeenCalled();
  });

  it('reads card_authorizations for the owned card and maps the rows', async () => {
    mockAuthRows = [
      {
        id: 'a1',
        amount: 1549,
        currency: 'USD',
        merchant_name: 'Netflix',
        merchant_category: 'digital_goods_media',
        approved: true,
        transaction_date: '2026-11-01T10:00:00Z',
        livemode: false,
      },
    ];
    const r = await listCardTransactions('ic_mine', 'user-a', 500);
    expect(mockAuthQuery).toHaveBeenCalledWith({
      table: 'card_authorizations',
      filters: { stripe_card_id: 'ic_mine' },
      limit: 100,
    });
    expect(r).toEqual({
      ok: true,
      data: [
        {
          id: 'a1',
          amount: 1549,
          currency: 'usd',
          merchantName: 'Netflix',
          merchantCategory: 'digital_goods_media',
          approved: true,
          date: '2026-11-01T10:00:00Z',
          livemode: false,
        },
      ],
    });
  });
});
