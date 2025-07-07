import { useMemo } from 'react';
import { useActiveSubscriptions } from './useSubscriptions';

interface TabBadgeInfo {
  show: boolean;
  count?: number;
  type: 'number' | 'dot';
  color: 'red' | 'green' | 'blue';
}

interface TabBadges {
  subscriptions: TabBadgeInfo;
  analytics: TabBadgeInfo;
}

/**
 * Hook for managing tab bar badge notifications
 * - Red numerical badge on Subscriptions tab for renewals within 72 hours
 * - Green dot on Analytics tab for positive monthly growth
 */
export const useTabBadges = (): TabBadges => {
  const { data: subscriptions = [] } = useActiveSubscriptions();

  const subscriptionsBadge = useMemo(() => {
    const now = new Date();
    const seventyTwoHoursFromNow = new Date(now.getTime() + (72 * 60 * 60 * 1000));

    const upcomingRenewals = subscriptions.filter(sub => {
      if (!sub.renewalDate || sub.status !== 'Active') return false;
      
      const renewalDate = new Date(sub.renewalDate);
      return renewalDate >= now && renewalDate <= seventyTwoHoursFromNow;
    });

    return {
      show: upcomingRenewals.length > 0,
      count: upcomingRenewals.length,
      type: 'number' as const,
      color: 'red' as const,
    };
  }, [subscriptions]);

  const analyticsBadge = useMemo(() => {
    // Calculate if current month shows positive growth
    // This is a simplified calculation - in a real app, you'd use actual analytics data
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Mock calculation for demonstration
    // In a real app, this would come from your analytics service
    const currentMonthSpending = subscriptions.reduce((sum, sub) => {
      if (sub.status === 'Active') {
        return sum + sub.monthlyCost;
      }
      return sum;
    }, 0);
    
    // Simple growth simulation - in reality, you'd compare with previous month
    const hasPositiveGrowth = currentMonthSpending > 100; // Arbitrary threshold for demo
    
    return {
      show: hasPositiveGrowth,
      type: 'dot' as const,
      color: 'green' as const,
    };
  }, [subscriptions]);

  return {
    subscriptions: subscriptionsBadge,
    analytics: analyticsBadge,
  };
};