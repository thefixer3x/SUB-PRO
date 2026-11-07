import { createSupabaseInsightStore, scanInsights, type InsightStore } from '../server/insights';
import type {
  CardAuthorizationRow,
  EnvelopeRow,
  EnvelopeSpendRow,
  InsightEvent,
  SubscriptionRow,
} from '../services/insightEngine';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';

function makeStore(overrides: Partial<InsightStore> = {}): InsightStore {
  return {
    getConsent: jest.fn(async () => true),
    listAuthorizations: jest.fn(async (): Promise<CardAuthorizationRow[]> => []),
    listSubscriptions: jest.fn(async (): Promise<SubscriptionRow[]> => []),
    listEnvelopes: jest.fn(async (): Promise<EnvelopeRow[]> => []),
    listEnvelopeSpend: jest.fn(async (): Promise<EnvelopeSpendRow[]> => []),
    listInsightKeys: jest.fn(async () => new Set<string>()),
    insertInsights: jest.fn(async (_userId: string, events: InsightEvent[]) => events.length),
    ...overrides,
  };
}

const unusedSubscription: SubscriptionRow = {
  id: 'sub-row-1',
  name: 'Streaming App',
  category: 'Entertainment',
  monthly_cost: 12.99,
  currency: 'USD',
  renewal_date: '2026-11-10T00:00:00.000Z',
  last_used: null,
  status: 'Active',
};

describe('scanInsights consent and deduplication', () => {
  it('does not read authorization rows unless Stripe is explicitly in test mode', async () => {
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = '';
    const admin = { from: jest.fn() } as unknown as Parameters<typeof createSupabaseInsightStore>[0];

    try {
      const result = await createSupabaseInsightStore(admin).listAuthorizations(USER_ID);
      expect(result).toEqual([]);
      expect(admin.from).not.toHaveBeenCalled();
    } finally {
      process.env.STRIPE_SECRET_KEY = previousKey;
    }
  });

  it('does not read any spending data until the user has opted in', async () => {
    const store = makeStore({ getConsent: jest.fn(async () => false) });

    const result = await scanInsights(store, USER_ID, { now: NOW });

    expect(result).toEqual({ consented: false, detected: 0, created: 0 });
    expect(store.listAuthorizations).not.toHaveBeenCalled();
    expect(store.listSubscriptions).not.toHaveBeenCalled();
    expect(store.listEnvelopes).not.toHaveBeenCalled();
    expect(store.insertInsights).not.toHaveBeenCalled();
  });

  it('writes only findings that do not already exist for this user', async () => {
    const knownKey = 'unused_before_renewal:sub-row-1:2026-11';
    const store = makeStore({
      listSubscriptions: jest.fn(async () => [unusedSubscription]),
      listInsightKeys: jest.fn(async () => new Set([knownKey])),
    });

    const result = await scanInsights(store, USER_ID, { now: NOW });

    expect(result).toEqual({ consented: true, detected: 1, created: 0 });
    expect(store.insertInsights).toHaveBeenCalledWith(USER_ID, []);
  });

  it('stores a checkable, plain-text finding when the user opts in', async () => {
    const store = makeStore({
      listSubscriptions: jest.fn(async () => [unusedSubscription]),
    });

    const result = await scanInsights(store, USER_ID, { now: NOW });

    expect(result).toEqual({ consented: true, detected: 1, created: 1 });
    expect(store.listEnvelopeSpend).toHaveBeenCalledWith([], '2026-11');
    expect(store.insertInsights).toHaveBeenCalledWith(
      USER_ID,
      expect.arrayContaining([
        expect.objectContaining({
          type: 'unused_before_renewal',
          sourceEventIds: ['sub-row-1'],
          explanation: expect.stringContaining('no recorded usage'),
        }),
      ]),
    );
  });
});
