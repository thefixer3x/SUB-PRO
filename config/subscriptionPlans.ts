import { SubscriptionPlan } from '@/types/monetization';

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Track up to 5 subscriptions',
      'Basic analytics dashboard',
      'Standard charts and reports',
      'Email notifications',
      'Community support'
    ],
    limits: {
      maxSubscriptions: 5,
      maxTeamMembers: null,
      analyticsHistory: 30,
      exportFormats: ['csv'],
      smartInsights: false,
      bulkUpload: false,
      adFree: false,
      prioritySupport: false,
      customReports: false,
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and small businesses',
    price: 4.99,
    billingCycle: 'monthly',
    features: [
      'Unlimited subscriptions',
      'Advanced analytics with Smart Insights™',
      'Bulk content upload',
      'Ad-free experience',
      'All export formats (CSV, PDF, Excel)',
      'Email & chat support',
      'Custom categories and tags',
      'Advanced filtering and search'
    ],
    limits: {
      maxSubscriptions: null,
      maxTeamMembers: null,
      analyticsHistory: 365,
      exportFormats: ['csv', 'pdf', 'xlsx', 'json'],
      smartInsights: true,
      bulkUpload: true,
      adFree: true,
      prioritySupport: false,
      customReports: true,
    },
    stripeProductId: 'prod_pro_plan',
    stripePriceId: 'price_pro_monthly'
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'Collaborative workspace for teams',
    price: 2.00, // per user per month
    billingCycle: 'monthly',
    features: [
      'All Pro features included',
      'Collaborative workspaces',
      'Team management dashboard',
      'Shared subscription libraries',
      'Role-based permissions',
      'Priority support',
      'Custom analytics reports',
      'API access',
      'White-label options'
    ],
    limits: {
      maxSubscriptions: null,
      maxTeamMembers: 50,
      analyticsHistory: 730,
      exportFormats: ['csv', 'pdf', 'xlsx', 'json', 'api'],
      smartInsights: true,
      bulkUpload: true,
      adFree: true,
      prioritySupport: true,
      customReports: true,
    },
    stripeProductId: 'prod_team_plan',
    stripePriceId: 'price_team_monthly'
  }
};

export const AD_CONFIG = {
  enabled: true,
  bannerFrequency: 5, // 5 minutes
  interstitialFrequency: 15, // 15 minutes
  maxAdsPerHour: 6,
  adMobIds: {
    banner: 'ca-app-pub-3940256099942544/6300978111', // Test ID
    interstitial: 'ca-app-pub-3940256099942544/1033173712', // Test ID
    rewarded: 'ca-app-pub-3940256099942544/5224354917' // Test ID
  },
  adSenseIds: {
    publisher: 'ca-pub-0000000000000000', // Replace with actual
    slot: '0000000000'
  }
};