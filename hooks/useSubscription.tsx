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

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    return {
      currentTier: 'free' as SubscriptionTier,
      subscription: null,
      isLoading: false,
      error: null,
      canAccessFeature: () => true,
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
        setCurrentTier('free' as SubscriptionTier);
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
        const row = data as { subscription_tier?: string } | null;
        const tier = row?.subscription_tier as SubscriptionTier | null | undefined;
        setCurrentTier(tier ?? 'free' as SubscriptionTier);
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

  const canAccessFeature = (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits): boolean => {
    // Deny by default when tier is unknown, loading, or the read errored.
    if (!currentTier) return false;

    const plan = SUBSCRIPTION_PLANS[currentTier];
    if (!plan) return false;

    const limit = plan.limits[feature];

    if (limit === null || limit === true) return true;
    if (limit === false) return false;

    // Numeric limits
    if (feature === 'maxSubscriptions') {
      return limit === null || (typeof limit === 'number' && currentUsage.subscriptions < limit);
    }
    if (feature === 'maxTeamMembers') {
      return limit === null || (typeof limit === 'number' && currentUsage.teamMembers < limit);
    }

    return true;
  };

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
