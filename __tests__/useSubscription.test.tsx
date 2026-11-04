/**
 * S202: the subscription tier gate and the refresh after checkout.
 *
 * Only the hook's dependencies are mocked here (the signed-in user and the
 * profiles row). The hook, the gate and the billing/success screen are real.
 */
import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import type { SubscriptionTier } from '@/types/monetization';

// ── Mocked dependencies ────────────────────────────────────────────
let mockUser: { id: string; email: string } | null = { id: 'user-1', email: 'user@example.com' };
// Each read of profiles.subscription_tier takes the next value; the last one repeats.
let mockTierReads: Array<{ tier?: string | null; error?: string }> = [];
const mockProfileReads = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          single: async () => {
            mockProfileReads(table, id);
            const next = mockTierReads.length > 1 ? mockTierReads.shift()! : mockTierReads[0];
            if (next?.error) return { data: null, error: new Error(next.error) };
            return { data: { subscription_tier: next?.tier ?? null }, error: null };
          },
        }),
      }),
    }),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  router: { replace: jest.fn() },
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', textSecondary: '#666', textMuted: '#999', primary: '#36f' },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// eslint-disable-next-line import/first
import {
  SubscriptionProvider,
  canAccessFeatureForTier,
  useSubscription,
} from '@/hooks/useSubscription';
// eslint-disable-next-line import/first
import BillingSuccess, { TIER_POLL_INTERVAL_MS, TIER_POLL_MAX_ATTEMPTS } from '@/app/billing/success';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SubscriptionProvider>{children}</SubscriptionProvider>
);

beforeEach(() => {
  mockUser = { id: 'user-1', email: 'user@example.com' };
  mockTierReads = [{ tier: 'free' }];
  mockProfileReads.mockClear();
});

describe('canAccessFeatureForTier (deny by default)', () => {
  const usage = { subscriptions: 0, teamMembers: 0 };

  it('denies when the tier is unknown or loading', () => {
    expect(canAccessFeatureForTier(undefined, 'maxSubscriptions', usage)).toBe(false);
    expect(canAccessFeatureForTier(undefined, 'subscriptionSharing', usage)).toBe(false);
    expect(canAccessFeatureForTier('enterprise' as SubscriptionTier, 'smartInsights', usage)).toBe(false);
  });

  it('grants what the plan allows and denies what it does not', () => {
    expect(canAccessFeatureForTier('pro', 'subscriptionSharing', usage)).toBe(true);
    expect(canAccessFeatureForTier('free', 'subscriptionSharing', usage)).toBe(false);
    expect(canAccessFeatureForTier('free', 'smartInsights', usage)).toBe(false);
  });

  it('denies a numeric limit once usage reaches it', () => {
    const limit = SUBSCRIPTION_PLANS.free.limits.maxSubscriptions as number;
    expect(canAccessFeatureForTier('free', 'maxSubscriptions', { subscriptions: limit - 1, teamMembers: 0 })).toBe(true);
    expect(canAccessFeatureForTier('free', 'maxSubscriptions', { subscriptions: limit, teamMembers: 0 })).toBe(false);
  });
});

describe('useSubscription', () => {
  it('denies everything outside a provider', () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
    expect(result.current.canAccessFeature('maxSubscriptions')).toBe(false);
  });

  it('denies while the tier is loading, then reads profiles.subscription_tier', async () => {
    mockTierReads = [{ tier: 'pro' }];
    const { result } = renderHook(() => useSubscription(), { wrapper });

    expect(result.current.currentTier).toBeUndefined();
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);

    await waitFor(() => expect(result.current.currentTier).toBe('pro'));
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(true);
    expect(mockProfileReads).toHaveBeenCalledWith('profiles', 'user-1');
  });

  it('treats a missing tier as free', async () => {
    mockTierReads = [{ tier: null }];
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentTier).toBe('free');
  });

  it('treats an unknown stored tier as unknown and denies', async () => {
    mockTierReads = [{ tier: 'enterprise' }];
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentTier).toBeUndefined();
    expect(result.current.canAccessFeature('smartInsights')).toBe(false);
  });

  it('denies when the read fails', async () => {
    mockTierReads = [{ error: 'network down' }];
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentTier).toBeUndefined();
    expect(result.current.error).not.toBeNull();
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
  });

  it('denies and reads nothing when nobody is signed in', async () => {
    mockUser = null;
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentTier).toBeUndefined();
    expect(mockProfileReads).not.toHaveBeenCalled();
  });

  it('refreshTier picks up a tier the webhook wrote later', async () => {
    mockTierReads = [{ tier: 'free' }, { tier: 'pro' }];
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.currentTier).toBe('free'));

    act(() => result.current.refreshTier());
    await waitFor(() => expect(result.current.currentTier).toBe('pro'));
  });
});

describe('billing/success', () => {
  // The screen reads the shared provider, so a paid tier it finds unlocks
  // features for every component under the same provider.
  const Probe = ({ onTier }: { onTier: (t: SubscriptionTier | undefined) => void }) => {
    onTier(useSubscription().currentTier);
    return null;
  };

  afterEach(() => jest.useRealTimers());

  it('re-reads the tier until the webhook has written it, then shows the plan', async () => {
    jest.useFakeTimers();
    // The webhook lands after two reads.
    mockTierReads = [{ tier: 'free' }, { tier: 'free' }, { tier: 'free' }, { tier: 'team' }];
    let seenByOtherComponent: SubscriptionTier | undefined;

    const screen = render(
      <SubscriptionProvider>
        <BillingSuccess />
        <Probe onTier={t => { seenByOtherComponent = t; }} />
      </SubscriptionProvider>,
    );

    for (let i = 0; i < 5 && seenByOtherComponent !== 'team'; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(TIER_POLL_INTERVAL_MS);
      });
    }

    expect(seenByOtherComponent).toBe('team');
    expect(await screen.findByText(/Your Team plan is now active/)).toBeTruthy();
    expect(mockProfileReads.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('stops polling after the limit and says activation may take a minute', async () => {
    jest.useFakeTimers();
    mockTierReads = [{ tier: 'free' }];

    const screen = render(
      <SubscriptionProvider>
        <BillingSuccess />
      </SubscriptionProvider>,
    );

    for (let i = 0; i < TIER_POLL_MAX_ATTEMPTS + 3; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(TIER_POLL_INTERVAL_MS);
      });
    }

    expect(await screen.findByText(/can take a minute to activate/)).toBeTruthy();
    // One initial read plus at most TIER_POLL_MAX_ATTEMPTS refreshes.
    expect(mockProfileReads.mock.calls.length).toBeLessThanOrEqual(TIER_POLL_MAX_ATTEMPTS + 1);
  });
});
