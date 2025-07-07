import { Platform } from 'react-native';

// Stripe configuration for client and server environments
export interface StripeConfig {
  publishableKey: string;
  proPriceId: string;
  premiumPriceId: string;
}

// Client-side configuration (safe for public exposure)
export const stripeConfig: StripeConfig = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  proPriceId: process.env.EXPO_PUBLIC_STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || '',
  premiumPriceId: process.env.EXPO_PUBLIC_STRIPE_PREMIUM_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID || '',
};

// Server-side configuration (never expose these to client)
export const stripeServerConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

// Validate configuration
export const validateStripeConfig = (): boolean => {
  const isServer = Platform.OS === 'web' && typeof window === 'undefined';
  
  if (isServer) {
    // Server-side validation
    if (!stripeServerConfig.secretKey) {
      console.error('STRIPE_SECRET_KEY is required for server operations');
      return false;
    }
    if (!stripeServerConfig.webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is required for webhook handling');
      return false;
    }
  }
  
  // Client-side validation
  if (!stripeConfig.publishableKey) {
    console.error('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is required');
    return false;
  }
  
  if (!stripeConfig.proPriceId || !stripeConfig.premiumPriceId) {
    console.warn('Stripe price IDs not configured - subscription features may not work');
  }
  
  return true;
};

// Helper to check if we're in a server environment
export const isServerEnvironment = (): boolean => {
  return Platform.OS === 'web' && typeof window === 'undefined';
};
