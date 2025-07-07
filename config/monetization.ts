import { AdConfig, SubscriptionPlan } from '@/types/monetization';

// Ad configuration for monetization
export const adConfig: AdConfig = {
  enabled: process.env.EXPO_PUBLIC_MONETIZATION_V1 === 'true',
  bannerFrequency: 5, // 5 minutes between banner ads
  interstitialFrequency: 15, // 15 minutes
  maxAdsPerHour: 6,
  adMobIds: {
    banner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/6300978111',
    interstitial: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-3940256099942544/1033173712',
    rewarded: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || 'ca-app-pub-3940256099942544/5224354917',
  },
  adSenseIds: {
    publisher: process.env.EXPO_PUBLIC_ADSENSE_PUBLISHER_ID || 'ca-pub-0000000000000000',
    slot: process.env.EXPO_PUBLIC_ADSENSE_SLOT_ID || '0000000000'
  }
};

// Subscription plans configuration
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Track up to 10 subscriptions',
      'Basic renewal alerts',
      'Mobile & web access',
      'Community support'
    ],
    limits: {
      maxSubscriptions: 10,
      maxTeamMembers: 1,
      analyticsHistory: 30,
      exportFormats: ['CSV'],
      smartInsights: false,
      bulkUpload: false,
      adFree: false,
      prioritySupport: false,
      customReports: false
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Most popular for individuals',
    price: 4.99,
    billingCycle: 'monthly',
    features: [
      'Unlimited subscriptions',
      'Auto-detection & sync',
      'Advanced analytics',
      'Smart insights',
      'Priority support',
      'Ad-free experience'
    ],
    limits: {
      maxSubscriptions: null,
      maxTeamMembers: 1,
      analyticsHistory: 365,
      exportFormats: ['CSV', 'PDF', 'Excel'],
      smartInsights: true,
      bulkUpload: true,
      adFree: true,
      prioritySupport: true,
      customReports: true
    },
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For teams and families',
    price: 9.99,
    billingCycle: 'monthly',
    features: [
      'Everything in Pro',
      'Team accounts (up to 5 members)',
      'Shared subscriptions',
      'Admin controls',
      'Team analytics',
      'Priority support'
    ],
    limits: {
      maxSubscriptions: null,
      maxTeamMembers: 5,
      analyticsHistory: 365,
      exportFormats: ['CSV', 'PDF', 'Excel'],
      smartInsights: true,
      bulkUpload: true,
      adFree: true,
      prioritySupport: true,
      customReports: true
    },
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID
  }
];

// Get current user's plan
export const getUserPlan = (tier: string): SubscriptionPlan => {
  return subscriptionPlans.find(plan => plan.id === tier) || subscriptionPlans[0];
};

// Check if user can see ads
export const shouldShowAds = (tier: string): boolean => {
  const plan = getUserPlan(tier);
  return !plan.limits.adFree && adConfig.enabled;
};

// Ad frequency controls
export const canShowInterstitial = (lastShown: Date | null): boolean => {
  if (!lastShown) return true;
  const now = new Date();
  const timeDiff = (now.getTime() - lastShown.getTime()) / (1000 * 60); // minutes
  return timeDiff >= adConfig.interstitialFrequency;
};

export const canShowBanner = (lastShown: Date | null): boolean => {
  if (!lastShown) return true;
  const now = new Date();
  const timeDiff = (now.getTime() - lastShown.getTime()) / (1000 * 60); // minutes
  return timeDiff >= adConfig.bannerFrequency;
};

// Rate limiting for ads
export const hasExceededAdLimit = (adsShownThisHour: number): boolean => {
  return adsShownThisHour >= adConfig.maxAdsPerHour;
};

// Virtual card limits per tier
export const getVirtualCardLimits = (tier: string): { maxCards: number; monthlySpendLimit: number } => {
  switch (tier) {
    case 'free':
      return { maxCards: 1, monthlySpendLimit: 100 }; // $100 limit for free users
    case 'pro':
      return { maxCards: 5, monthlySpendLimit: 1000 }; // $1000 limit for pro users
    case 'team':
      return { maxCards: 20, monthlySpendLimit: 5000 }; // $5000 limit for team users
    default:
      return { maxCards: 1, monthlySpendLimit: 100 };
  }
};

// Check if user can create more virtual cards
export const canCreateVirtualCard = (currentCards: number, tier: string): boolean => {
  const limits = getVirtualCardLimits(tier);
  return currentCards < limits.maxCards;
};

// Rewarded ad benefits
export const getRewardedAdBenefits = (tier: string): { tempProAccess: number; extraCards: number } => {
  if (tier !== 'free') return { tempProAccess: 0, extraCards: 0 };
  
  return {
    tempProAccess: 24, // 24 hours of pro features
    extraCards: 1 // 1 additional virtual card for 30 days
  };
};

// Ad placement scoring for optimization
export const getAdPlacementScore = (placement: string, userEngagement: number): number => {
  const placementScores = {
    'home': 0.8,
    'subscriptions': 0.9,
    'analytics': 0.7,
    'community': 0.6
  };
  
  const baseScore = placementScores[placement as keyof typeof placementScores] || 0.5;
  return Math.min(baseScore * (1 + userEngagement), 1.0);
};

// Revenue tracking helpers
export const calculateAdRevenue = (impressions: number, clicks: number, cpm: number = 2.0): number => {
  return (impressions / 1000) * cpm; // Revenue based on CPM
};

export const getSubscriptionRevenue = (tier: string): number => {
  const plan = getUserPlan(tier);
  return plan.price;
};

// Feature gate helpers for monetization
export const hasFeatureAccess = (tier: string, feature: keyof SubscriptionPlan['limits']): boolean => {
  const plan = getUserPlan(tier);
  const featureValue = plan.limits[feature];
  
  if (typeof featureValue === 'boolean') {
    return featureValue;
  }
  
  return featureValue !== null;
};

// Smart upsell suggestions
export const getUpsellSuggestion = (tier: string, featureAttempted: string): { 
  suggestedTier: string; 
  benefit: string; 
  urgency: 'low' | 'medium' | 'high' 
} => {
  if (tier === 'free') {
    return {
      suggestedTier: 'pro',
      benefit: `Unlock ${featureAttempted} and remove ads for just $4.99/month`,
      urgency: 'high'
    };
  }
  
  if (tier === 'pro') {
    return {
      suggestedTier: 'team',
      benefit: `Add team collaboration and get ${featureAttempted} for $9.99/month`,
      urgency: 'medium'
    };
  }
  
  return {
    suggestedTier: tier,
    benefit: 'You have access to all features',
    urgency: 'low'
  };
};
