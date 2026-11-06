import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { hasFeatureAccess, subscriptionPlans } from '@/config/monetization';
import { SubscriptionProvider, useSubscription } from '@/hooks/useSubscription';

// Only the hook's dependencies are mocked: a signed-in user whose profile
// row is still loading. The hook and its gate are real.
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'user@example.com' } }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => new Promise(() => {}) }),
      }),
    }),
  },
}));

const SHARING_CODE_FILES = [
  'app/(tabs)/shared-groups.tsx',
  'components/social/ShareButton.tsx',
  'components/social/SharedGroupsDisplay.tsx',
  'components/social/ShareSubscriptionModal.tsx',
  'components/social/SharedGroupDetails.tsx',
  'components/social/SharedGroupCard.tsx',
];

describe('subscriptionSharing entitlement', () => {
  it('gives the free plan no sharing access and pro/team access', () => {
    // The table the runtime gate reads (config/subscriptionPlans.ts).
    expect(SUBSCRIPTION_PLANS.free.limits.subscriptionSharing).toBe(false);
    expect(SUBSCRIPTION_PLANS.pro.limits.subscriptionSharing).toBe(true);
    expect(SUBSCRIPTION_PLANS.team.limits.subscriptionSharing).toBe(true);

    // The same limit in the monetization plan table.
    expect(hasFeatureAccess('free', 'subscriptionSharing')).toBe(false);
    expect(hasFeatureAccess('pro', 'subscriptionSharing')).toBe(true);
    expect(hasFeatureAccess('team', 'subscriptionSharing')).toBe(true);

    const byId = Object.fromEntries(subscriptionPlans.map(plan => [plan.id, plan]));
    expect(byId.free.limits.subscriptionSharing).toBe(false);
    expect(byId.pro.limits.subscriptionSharing).toBe(true);
    expect(byId.team.limits.subscriptionSharing).toBe(true);
  });

  it('keeps sharing access independent of smartInsights', () => {
    // Sharing has its own limit, so the two entitlements can differ per tier.
    expect(SUBSCRIPTION_PLANS.free.limits.smartInsights).toBe(false);
    expect(SUBSCRIPTION_PLANS.free.limits.subscriptionSharing).toBe(false);
    expect(SUBSCRIPTION_PLANS.pro.limits.smartInsights).toBe(true);
    expect(SUBSCRIPTION_PLANS.pro.limits.subscriptionSharing).toBe(true);
  });

  it('denies sharing through useSubscription().canAccessFeature for a free account', () => {
    // When the user has no profile row yet (or tier is still loading),
    // canAccessFeature must deny by default — even if the user is technically "free".
    const { result } = renderHook(() => useSubscription(), {
      wrapper: ({ children }) => <SubscriptionProvider>{children}</SubscriptionProvider>,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.currentTier).toBeUndefined();
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
  });

  it('no longer gates sharing on smartInsights', () => {
    for (const file of SHARING_CODE_FILES) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).not.toContain('smartInsights');
    }
  });
});
