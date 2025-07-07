import { AffiliateLink } from '@/types/embeddedFinance';
import { EMBEDDED_FINANCE_CONFIG } from '@/config/embeddedFinance';

export interface CreateAffiliateLinkParams {
  subscriptionId: string;
  originalUrl: string;
  provider: string;
  commission?: number;
}

export interface AffiliateClickEvent {
  affiliateLinkId: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  referrer?: string;
}

class AffiliateSystemService {
  private config = EMBEDDED_FINANCE_CONFIG.affiliates;

  async createAffiliateLink(params: CreateAffiliateLinkParams): Promise<AffiliateLink> {
    try {
      const response = await fetch('/api/embedded-finance/affiliates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          commission: params.commission || this.config.defaultCommission,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create affiliate link');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create affiliate link:', error);
      throw error;
    }
  }

  async getAffiliateLink(subscriptionId: string): Promise<AffiliateLink | null> {
    try {
      const response = await fetch(`/api/embedded-finance/affiliates/subscription/${subscriptionId}`);
      
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch affiliate link');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch affiliate link:', error);
      return null;
    }
  }

  async trackClick(clickEvent: AffiliateClickEvent): Promise<void> {
    if (!this.config.trackingEnabled) {
      return;
    }

    try {
      await fetch('/api/embedded-finance/affiliates/track-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clickEvent),
      });
    } catch (error) {
      console.error('Failed to track affiliate click:', error);
      // Don't throw error for tracking failures
    }
  }

  async trackConversion(affiliateLinkId: string, conversionValue: number): Promise<void> {
    if (!this.config.trackingEnabled) {
      return;
    }

    try {
      await fetch('/api/embedded-finance/affiliates/track-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliateLinkId,
          conversionValue,
        }),
      });
    } catch (error) {
      console.error('Failed to track affiliate conversion:', error);
      // Don't throw error for tracking failures
    }
  }

  generateTrackingUrl(affiliateUrl: string, userId: string, subscriptionId: string): string {
    const url = new URL(affiliateUrl);
    
    // Add tracking parameters
    url.searchParams.set('utm_source', 'app');
    url.searchParams.set('utm_medium', 'subscription_manager');
    url.searchParams.set('utm_campaign', 'plan_switch');
    url.searchParams.set('ref_user', userId);
    url.searchParams.set('ref_subscription', subscriptionId);
    
    return url.toString();
  }

  async getAffiliateStats(subscriptionId: string): Promise<{
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalCommission: number;
  }> {
    try {
      const response = await fetch(`/api/embedded-finance/affiliates/stats/${subscriptionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch affiliate stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch affiliate stats:', error);
      return {
        totalClicks: 0,
        totalConversions: 0,
        conversionRate: 0,
        totalCommission: 0,
      };
    }
  }

  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      
      // Remove potentially harmful parameters
      const dangerousParams = ['javascript', 'data', 'vbscript'];
      dangerousParams.forEach(param => {
        parsedUrl.searchParams.delete(param);
      });

      return parsedUrl.toString();
    } catch {
      throw new Error('Invalid URL provided');
    }
  }
}

export const affiliateSystemService = new AffiliateSystemService();