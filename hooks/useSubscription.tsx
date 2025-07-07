import { useState, useEffect, createContext, useContext } from 'react';
import { SubscriptionTier, UserSubscription } from '@/types/monetization';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

interface SubscriptionContextType {
  currentTier: SubscriptionTier;
  subscription: UserSubscription | null;
  isLoading: boolean;
  canAccessFeature: (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits) => boolean;
  getRemainingLimit: (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits) => number | null;
  upgradeRequired: (feature: string) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const useSubscriptionData = () => {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUsage, setCurrentUsage] = useState({
    subscriptions: 0,
    teamMembers: 0,
  });

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      const mockSubscription: UserSubscription = {
        id: '1',
        userId: 'user-1',
        tier: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setSubscription(mockSubscription);
      setCurrentTier(mockSubscription.tier);
      
      // Load current usage
      setCurrentUsage({
        subscriptions: 3, // Mock data
        teamMembers: 1,
      });
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canAccessFeature = (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits): boolean => {
    const plan = SUBSCRIPTION_PLANS[currentTier];
    const limit = plan.limits[feature];
    
    if (limit === null || limit === true) return true;
    if (limit === false) return false;
    
    // Check usage against numeric limits
    if (feature === 'maxSubscriptions') {
      return limit === null || (typeof limit === 'number' && currentUsage.subscriptions < limit);
    }
    if (feature === 'maxTeamMembers') {
      return limit === null || (typeof limit === 'number' && currentUsage.teamMembers < limit);
    }
    
    return true;
  };

  const getRemainingLimit = (feature: keyof typeof SUBSCRIPTION_PLANS.free.limits): number | null => {
    const plan = SUBSCRIPTION_PLANS[currentTier];
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
    // TODO: Show upgrade modal
    console.log(`Upgrade required for feature: ${feature}`);
  };

  return {
    currentTier,
    subscription,
    isLoading,
    canAccessFeature,
    getRemainingLimit,
    upgradeRequired,
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