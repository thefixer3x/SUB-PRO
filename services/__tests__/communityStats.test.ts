import { communityStatsService } from '@/services/communityStats';
import { Subscription } from '@/types/subscription';

const mockFetch = jest.fn();

describe('communityStatsService.contributeToCommunityStats consent gate', () => {
  const subscriptions: Subscription[] = [
    {
      id: 'sub-1',
      name: 'Netflix',
      category: 'Entertainment',
      status: 'Active',
      planName: 'Premium',
      monthlyCost: 15.99,
      currency: 'USD',
      billingCycle: 'Monthly',
      renewalDate: new Date('2026-12-01'),
      paymentMethod: 'pm_1',
      priority: 'Medium',
    },
  ];

  const sharingResponse = (
    enabled: boolean,
    dataTypes: { subscriptionCosts: boolean; categories: boolean; planTypes: boolean }
  ) => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({
      userId: 'user-1',
      enabled,
      dataTypes,
      consentDate: new Date('2026-01-01'),
    }),
  });

  const contributions = () =>
    mockFetch.mock.calls.filter(call => String(call[0]).includes('/api/social/contribute-stats'));

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: unknown }).fetch = mockFetch;
  });

  it('sends nothing when the user has not consented', async () => {
    mockFetch.mockResolvedValue(
      sharingResponse(false, { subscriptionCosts: false, categories: false, planTypes: false }),
    );

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(0);
  });

  it('sends nothing when the user opted out, even if the granular flags are stale', async () => {
    // The master switch and the per-type flags are written separately, so a
    // user who turns sharing off can still have `dataTypes` reading true. The
    // opt-out has to win on its own: if only the per-type check were
    // consulted, this would publish the whole subscription portfolio.
    mockFetch.mockResolvedValue(
      sharingResponse(false, { subscriptionCosts: true, categories: true, planTypes: true }),
    );

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(0);
  });

  it('sends nothing when the consent lookup fails', async () => {
    // The preferences endpoint errors out: the method must fail closed rather
    // than assume consent.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'boom' }),
    });

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(0);
  });

  it('sends nothing when the user consented to no data types', async () => {
    mockFetch.mockResolvedValue(
      sharingResponse(true, { subscriptionCosts: false, categories: false, planTypes: false }),
    );

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(0);
  });

  it('sends the contribution when the user consented to everything', async () => {
    mockFetch.mockResolvedValue(
      sharingResponse(true, { subscriptionCosts: true, categories: true, planTypes: true }),
    );

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(1);
    const body = JSON.parse(contributions()[0][1].body);
    expect(body.data).toEqual([
      {
        serviceName: 'Netflix',
        category: 'Entertainment',
        monthlyCost: 15.99,
        billingCycle: 'Monthly',
        planName: 'Premium',
      },
    ]);
  });

  it('only sends the fields the user consented to', async () => {
    mockFetch.mockResolvedValue(
      sharingResponse(true, { subscriptionCosts: false, categories: true, planTypes: false }),
    );

    await communityStatsService.contributeToCommunityStats('user-1', subscriptions);

    expect(contributions()).toHaveLength(1);
    const body = JSON.parse(contributions()[0][1].body);
    expect(body.data).toEqual([
      {
        serviceName: 'Netflix',
        category: 'Entertainment',
      },
    ]);
    expect(body.data[0].monthlyCost).toBeUndefined();
    expect(body.data[0].planName).toBeUndefined();
  });
});
