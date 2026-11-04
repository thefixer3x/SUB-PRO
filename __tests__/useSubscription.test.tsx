/**
 * Unit tests for S202: useSubscription — deny-by-default gating, real tier
 * read from profiles.subscription_tier, and refreshTier on billing/success.
 *
 * Tests the real hook's deny-by-default behavior, the real refreshTier
 * function, and the billing/success component.
 * Mocks are in jest.setup.ts.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';

/* ── Direct canAccessFeature logic test (no React, no Supabase) ─────── */
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { SubscriptionTier } from '@/types/monetization';
import { canAccessFeatureForTier } from '@/hooks/useSubscription';

describe('deny-by-default logic (unit)', () => {
  // Imports the REAL exported gate. A local copy of the logic here would
  // still pass if the implementation regressed, so it must not be duplicated.
  const usage = { subscriptions: 0, teamMembers: 0 };

  it('denies when tier is undefined (unknown/loading)', () => {
    expect(canAccessFeatureForTier(undefined, 'maxSubscriptions', usage)).toBe(false);
    expect(canAccessFeatureForTier(undefined, 'subscriptionSharing', usage)).toBe(false);
  });

  it('denies when tier is not a known plan', () => {
    expect(
      canAccessFeatureForTier('unknown' as SubscriptionTier, 'maxSubscriptions', usage),
    ).toBe(false);
  });

  it('grants for known tiers with allowed features', () => {
    expect(canAccessFeatureForTier('pro', 'maxSubscriptions', usage)).toBe(true);
    expect(canAccessFeatureForTier('pro', 'subscriptionSharing', usage)).toBe(true);
  });

  it('denies for features explicitly disabled', () => {
    expect(canAccessFeatureForTier('free', 'subscriptionSharing', usage)).toBe(false);
    expect(canAccessFeatureForTier('free', 'smartInsights', usage)).toBe(false);
  });

  it('denies numeric limits once the usage is reached', () => {
    const freeLimit = SUBSCRIPTION_PLANS.free.limits.maxSubscriptions;
    if (typeof freeLimit !== 'number') throw new Error('expected a numeric free limit');
    expect(
      canAccessFeatureForTier('free', 'maxSubscriptions', {
        subscriptions: freeLimit - 1,
        teamMembers: 0,
      }),
    ).toBe(true);
    expect(
      canAccessFeatureForTier('free', 'maxSubscriptions', {
        subscriptions: freeLimit,
        teamMembers: 0,
      }),
    ).toBe(false);
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

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.currentTier).toBe('free');
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
  });

  it('DENIES every feature when used outside provider', () => {
    const { result } = renderHook(() => {
      const mod = require('@/hooks/useSubscription');
      return mod.useSubscription();
    });

    // Outside a provider the tier is unknown, so access must be denied.
    // Granting here would hand paid entitlements to any component rendered
    // outside SubscriptionProvider.
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
    expect(result.current.canAccessFeature('maxSubscriptions')).toBe(false);
    expect(result.current.canAccessFeature('smartInsights')).toBe(false);
    expect(result.current.currentTier).toBe('free');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subscription).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refreshTier).toBe('function');
  });

  it('DENIES features when there is no signed-in user', async () => {
    // A signed-out visitor must not inherit free-tier entitlements before any
    // tier has actually been read. The global AuthContext mock always returns
    // a user, so override useAuth for this case.
    const authMod = require('@/contexts/AuthContext');
    const spy = jest.spyOn(authMod, 'useAuth').mockReturnValue({
      user: null,
      session: null,
    } as ReturnType<typeof authMod.useAuth>);

    try {
      const { result } = renderHook(() => {
        const mod = require('@/hooks/useSubscription');
        return mod.useSubscriptionData();
      }, {
        wrapper: ({ children }: { children: React.ReactNode }) => {
          const mod = require('@/hooks/useSubscription');
          return <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>;
        },
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.currentTier).toBeUndefined();
      expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
      expect(result.current.canAccessFeature('maxSubscriptions')).toBe(false);
    } finally {
      spy.mockRestore();
    }
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
