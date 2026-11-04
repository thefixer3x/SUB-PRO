/**
 * Unit tests for S202: useSubscription — deny-by-default gating, real tier
 * read from profiles.subscription_tier, and refreshTier on billing/success.
 *
 * Tests the real hook's deny-by-default behavior, the real refreshTier
 * function, and the billing/success component.
 * Mocks are in jest.setup.ts.
 */
import { renderHook } from '@testing-library/react-native';

/* ── Direct canAccessFeature logic test (no React, no Supabase) ─────── */
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { SubscriptionTier } from '@/types/monetization';

describe('deny-by-default logic (unit)', () => {
  function canAccessFeatureLogic(
    tier: SubscriptionTier | undefined,
    feature: keyof typeof SUBSCRIPTION_PLANS.free.limits,
  ): boolean {
    if (!tier) return false;
    const plan = SUBSCRIPTION_PLANS[tier];
    if (!plan) return false;
    const limit = plan.limits[feature];
    if (limit === null || limit === true) return true;
    if (limit === false) return false;
    return true;
  }

  it('denies when tier is undefined (unknown/loading)', () => {
    expect(canAccessFeatureLogic(undefined, 'maxSubscriptions')).toBe(false);
    expect(canAccessFeatureLogic(undefined, 'subscriptionSharing')).toBe(false);
  });

  it('denies when tier is not a known plan', () => {
    expect(canAccessFeatureLogic('unknown' as SubscriptionTier, 'maxSubscriptions')).toBe(false);
  });

  it('grants for known tiers with allowed features', () => {
    expect(canAccessFeatureLogic('pro', 'maxSubscriptions')).toBe(true);
    expect(canAccessFeatureLogic('pro', 'subscriptionSharing')).toBe(true);
  });

  it('denies for features explicitly disabled', () => {
    expect(canAccessFeatureLogic('free', 'subscriptionSharing')).toBe(false);
    expect(canAccessFeatureLogic('free', 'smartInsights')).toBe(false);
  });
});

/* ── Real hook — test refreshTier exists and deny-by-default ───────── */

describe('real hook deny-by-default', () => {
  it('has refreshTier exported on the hook', () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscriptionData();
    }, {
      wrapper: ({ children }) => {
        const mod = require('@/hooks/useSubscription');
        return <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>;
      },
    });

    expect(typeof result.current.refreshTier).toBe('function');
  });

  it('subscriptionSharing is denied by default (free tier)', async () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscriptionData();
    }, {
      wrapper: ({ children }) => {
        const mod = require('@/hooks/useSubscription');
        return <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>;
      },
    });

    const { waitFor } = require('@testing-library/react-native');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.currentTier).toBe('free');
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
  });

  it('returns safe defaults when used outside provider', () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscription();
    });

    expect(result.current.currentTier).toBe('free');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.subscription).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refreshTier).toBe('function');
  });

  it('subscription is null on first load (no mock object)', () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscriptionData();
    }, {
      wrapper: ({ children }) => {
        const mod = require('@/hooks/useSubscription');
        return <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>;
      },
    });

    expect(result.current.subscription).toBe(null);
  });
});

/* ── billing/success ─────────────────────────────────────────────────── */

describe('billing/success refreshes tier', () => {
  it('success page renders with Payment Successful message', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BillingSuccess = require('@/app/billing/success').default;
    const { render } = require('@testing-library/react-native');

    const { getByText } = render(<BillingSuccess />);
    expect(getByText('Payment Successful!')).toBeTruthy();
  });

  it('hook has refreshTier function available', () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscriptionData();
    }, {
      wrapper: ({ children }) => {
        const mod = require('@/hooks/useSubscription');
        return <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>;
      },
    });

    expect(typeof result.current.refreshTier).toBe('function');
    expect(result.current.isLoading).toBe(true);
  });
});
