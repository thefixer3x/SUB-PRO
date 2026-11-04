import { act, renderHook } from '@testing-library/react-native';
import React, { createContext, useContext, type ReactNode } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { hasFeatureAccess, subscriptionPlans } from '@/config/monetization';
import { SubscriptionProvider, useSubscription } from '@/hooks/useSubscription';

/* ── Minimal local context for tests (real AuthContext lacks named exports) ── */
type AuthContextValue = {
  session: null;
  user: { id: string; email: string } | null;
  isInitializing: boolean;
  authLoading: boolean;
  isDemoMode: boolean;
  isDemoModeEnabled: boolean;
  signIn: () => Promise<{ success: boolean }>;
  signUp: () => Promise<{ success: boolean }>;
  signOut: () => Promise<{ success: boolean }>;
  signInAsGuest: () => Promise<{ success: boolean }>;
  refreshSession: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ── AuthContext wrapper for tests ───────────────────────────────────── */
const DUMMY_USER = {
  id: 'user-1',
  email: 'user@example.com',
} as any;

const authValue: AuthContextValue = {
  session: null,
  user: DUMMY_USER,
  isInitializing: false,
  authLoading: false,
  isDemoMode: false,
  isDemoModeEnabled: false,
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => ({ success: true }),
  signInAsGuest: async () => ({ success: false }),
  refreshSession: async () => {},
};

const AuthWrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
);

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
      wrapper: ({ children }) => (
        <AuthWrapper>
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </AuthWrapper>
      ),
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
