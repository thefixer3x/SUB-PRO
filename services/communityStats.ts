import { CommunityStats, UserDataSharing } from '@/types/social';
import { Subscription } from '@/types/subscription';

class CommunityStatsService {
  async updateUserDataSharing(userId: string, sharing: Omit<UserDataSharing, 'userId'>): Promise<void> {
    try {
      const response = await fetch('/api/social/data-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...sharing }),
      });
      
      if (!response.ok) {
        console.error('Failed to update data sharing, status:', response.status);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update data sharing preferences');
        } else {
          throw new Error(`HTTP error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Failed to update data sharing preferences:', error);
      throw error;
    }
  }

  async getUserDataSharing(userId: string): Promise<UserDataSharing | null> {
    try {
      const response = await fetch(`/api/social/data-sharing?userId=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (!contentType || contentType.includes('application/json')) {
          return await response.json();
        } else {
          console.error('API returned non-JSON response:', await response.text());
          // Return default data if API returns non-JSON
          return {
            userId,
            enabled: false,
            dataTypes: {
              subscriptionCosts: false,
              categories: false,
              planTypes: false,
            },
            consentDate: new Date()
          };
          return null;
        }
      }
      if (response.status === 404) {
        console.log('Data sharing endpoint not found, providing default data');
        return {
          userId,
          enabled: false,
          dataTypes: {
            subscriptionCosts: false,
            categories: false,
            planTypes: false,
          },
          consentDate: new Date()
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get data sharing preferences:', error);
      return null;
    }
  }

  async getCommunityStats(): Promise<CommunityStats[]> {
    try {
      const response = await fetch('/api/social/community-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch community stats');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get community stats:', error);
      throw error;
    }
  }

  async contributeToCommunityStats(subscriptions: Subscription[]): Promise<void> {
    try {
      const anonymizedData = subscriptions.map(sub => ({
        serviceName: sub.name,
        category: sub.category,
        monthlyCost: sub.monthlyCost,
        planName: sub.planName,
        billingCycle: sub.billingCycle,
      }));

      await fetch('/api/social/contribute-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: anonymizedData }),
      });
    } catch (error) {
      console.error('Failed to contribute to community stats:', error);
      // Don't throw - this is non-critical
    }
  }

  async getMostTrackedServices(limit: number = 10): Promise<Array<{
    serviceName: string;
    userCount: number;
    averageCost: number;
    category: string;
  }>> {
    try {
      const response = await fetch(`/api/social/most-tracked?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch most tracked services');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get most tracked services:', error);
      return [];
    }
  }

  async getCategoryInsights(): Promise<Array<{
    category: string;
    averageCost: number;
    userCount: number;
    totalSpending: number;
  }>> {
    try {
      const response = await fetch('/api/social/category-insights');
      if (!response.ok) {
        throw new Error('Failed to fetch category insights');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get category insights:', error);
      return [];
    }
  }

  async getSpendingBenchmarks(userCategory: string, userCost: number): Promise<{
    percentile: number;
    isAboveAverage: boolean;
    averageCost: number;
    recommendation?: string;
  }> {
    try {
      const response = await fetch('/api/social/spending-benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: userCategory, cost: userCost }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch spending benchmarks');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get spending benchmarks:', error);
      return {
        percentile: 50,
        isAboveAverage: false,
        averageCost: userCost,
      };
    }
  }
}

export const communityStatsService = new CommunityStatsService();