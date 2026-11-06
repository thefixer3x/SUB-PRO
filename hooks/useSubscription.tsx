import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { SubscriptionTier, UserSubscription } from '@/types/monetization';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionContextType {
  currentTier: SubscriptionTier | undefined;
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: Error | null;
  canAccessFeature: (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits) => boolean;
  getRemainingLimit: (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits) => number | null;
  upgradeRequired: (feature: string) => void;
  refreshTier: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Pure tier gate. Denies by default: an unknown, loading or invalid tier
 * grants nothing. Exported so tests exercise the real implementation rather
 * than a copy of it.
 */
export const canAccessFeatureForTier = (
  tier: SubscriptionTier | undefined,
  feature: keyof typeof SUBSCRIPTION_PLANS.free.limits,
  usage: { subscriptions: number; teamMembers: number },
): boolean => {
  if (!tier) return false;

  const plan = SUBSCRIPTION_PLANS[tier];
  if (!plan) return false;

  const limit = plan.limits[feature];

  if (limit === null || limit === true) return true;
  if (limit === false) return false;

  if (feature === 'maxSubscriptions') {
    return typeof limit === 'number' && usage.subscriptions < limit;
  }
  if (feature === 'maxTeamMembers') {
    return typeof limit === 'number' && usage.teamMembers < limit;
  }

  return true;
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    // Outside a provider the tier is unknown, so access is DENIED. Granting
    // here would hand out paid entitlements to any component rendered outside
    // the SubscriptionProvider.
    return {
      currentTier: 'free' as SubscriptionTier,
      subscription: null,
      isLoading: true,
      error: null,
      canAccessFeature: () => false,
      getRemainingLimit: () => null,
      upgradeRequired: () => {},
      refreshTier: () => {},
    };
  }
  return context;
};

export const useSubscriptionData = () => {
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | undefined>(undefined);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUsage, setCurrentUsage] = useState({
    subscriptions: 0,
    teamMembers: 0,
  });

  const loadSubscriptionData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!user?.id) {
        // No signed-in user, so the tier is genuinely unknown. Leave it
        // undefined rather than assuming 'free' — canAccessFeature denies on
        // an unknown tier, and a signed-out visitor must not get entitlements.
        setCurrentTier(undefined);
        setIsLoading(false);
        return;
      }

      // Read tier from profiles.subscription_tier via Supabase (RLS-scoped).
      // Never reads user_tiers or stripe_subscriptions.
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (queryError) {
        setError(queryError as Error);
        setCurrentTier(undefined);
      } else {
        const row = data as { subscription_tier?: string | null } | null;
        const raw = row?.subscription_tier;
        // No tier stored means the account was never upgraded: free. A value
        // that is not a known plan (for example the retired 'enterprise') is
        // unknown, so it stays undefined and every paid feature is denied.
        if (raw == null) {
          setCurrentTier('free');
        } else if (Object.prototype.hasOwnProperty.call(SUBSCRIPTION_PLANS, raw)) {
          setCurrentTier(raw as SubscriptionTier);
        } else {
          setCurrentTier(undefined);
        }
        setSubscription(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setCurrentTier(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Deny by default when the tier is unknown, loading, or the read errored.
  const canAccessFeature = (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits): boolean =>
    canAccessFeatureForTier(currentTier, feature, currentUsage);

  const getRemainingLimit = (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits): number | null => {
    const plan = SUBSCRIPTION_PLANS[currentTier ?? 'free'];
    if (!plan) return null;

    const limit = plan.limits[feature];
    if (typeof limit !== 'number') return null;

    if (feature === 'maxSubscriptions') {
      return Math.max(0, limit - currentUsage.subscriptions);
    }
    if (feature === 'maxTeamMembers') {
      return Math.max(0, limit - currentUsage.teamMembers);
    }

    return null;
  };

  const upgradeRequired = (feature: string) => {
    console.log(`Upgrade required for feature: ${feature}`);
  };

  // Refresh the tier — call from billing/success to pick up webhook updates.
  const refreshTier = useCallback(() => {
    setCurrentTier(undefined);
    setIsLoading(true);
    setError(null);
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  return {
    currentTier,
    subscription,
    isLoading,
    error,
    canAccessFeature,
    getRemainingLimit,
    upgradeRequired,
    refreshTier,
  };
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const subscriptionData = useSubscriptionData();

  return (
    <SubscriptionContext.Provider value={subscriptionData}>
      {children}
    </SubscriptionContext.Provider>
  );
};
