export type SubscriptionTier = 'free' | 'pro' | 'team';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: {
    maxSubscriptions: number | null;
    maxTeamMembers: number | null;
    analyticsHistory: number; // days
    exportFormats: string[];
    smartInsights: boolean;
    bulkUpload: boolean;
    adFree: boolean;
    prioritySupport: boolean;
    customReports: boolean;
  };
  stripeProductId?: string;
  stripePriceId?: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  teamId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdConfig {
  enabled: boolean;
  bannerFrequency: number; // minutes between banner ads
  interstitialFrequency: number; // minutes between interstitial ads
  maxAdsPerHour: number;
  adMobIds: {
    banner: string;
    interstitial: string;
    rewarded: string;
  };
  adSenseIds: {
    publisher: string;
    slot: string;
  };
}