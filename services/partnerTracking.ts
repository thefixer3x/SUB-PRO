import { PartnerClick, PartnerStat } from '@/types/partner';
import { Platform } from 'react-native';

class PartnerTrackingService {
  async trackClick(partnerId: string, userId: string, clickSource: 'card' | 'modal'): Promise<void> {
    try {
      // Create click tracking data
      const clickData = {
        partnerId,
        userId,
        clickSource,
        timestamp: new Date(),
        userAgent: Platform.OS === 'web' ? navigator.userAgent : `${Platform.OS}/${Platform.Version}`,
      };
      
      // In a real app, send this to your backend API
      await fetch('/api/marketplace/track-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clickData),
      });
      
      console.log('Partner click tracked:', clickData);
    } catch (error) {
      // Don't let tracking errors impact the user experience
      console.error('Failed to track partner click:', error);
    }
  }

  generateReferenceUrl(deeplink: string, userId: string): string {
    try {
      const url = new URL(deeplink);
      
      // Append user reference parameter
      url.searchParams.set('ref', userId);
      
      // Add additional tracking parameters
      url.searchParams.set('utm_source', 'subscription_manager');
      url.searchParams.set('utm_medium', 'marketplace');
      url.searchParams.set('utm_campaign', 'partner_deal');
      
      return url.toString();
    } catch (error) {
      console.error('Failed to generate reference URL:', error);
      return deeplink; // Return original URL if there was an error
    }
  }

  async getPartnerStats(partnerId: string): Promise<PartnerStat> {
    try {
      // In a real app, fetch this from your backend
      const response = await fetch(`/api/marketplace/partner-stats/${partnerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch partner stats');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get partner stats:', error);
      
      // Return default stats on error
      return {
        totalClicks: 0,
        uniqueClicks: 0,
        conversionRate: 0,
      };
    }
  }
}

export const partnerTrackingService = new PartnerTrackingService();