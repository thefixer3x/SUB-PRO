import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { hasFeatureAccess, subscriptionPlans } from '@/config/monetization';
import { SubscriptionProvider, useSubscription } from '@/hooks/useSubscription';

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
    const { result } = renderHook(() => useSubscription(), { wrapper: SubscriptionProvider });

    expect(result.current.currentTier).toBe('free');
    expect(result.current.canAccessFeature('subscriptionSharing')).toBe(false);
  });

  it('no longer gates sharing on smartInsights', () => {
    for (const file of SHARING_CODE_FILES) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).not.toContain('smartInsights');
    }
  });
});
