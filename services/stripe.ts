import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';
import { stripeConfig, validateStripeConfig } from '@/config/stripe';

// Client-side Stripe instance for payment processing
let stripePromise: Promise<StripeJS | null>;

export const getStripe = () => {
  if (!stripePromise) {
    // Only use publishable key on client side
    if (!stripeConfig.publishableKey) {
      console.warn('Stripe publishable key not configured');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(stripeConfig.publishableKey);
  }
  return stripePromise;
};

// Server-side Stripe functions are now in stripe-server.ts
// Import that file only in API routes that need server-side Stripe

// Legacy interfaces for backward compatibility
export interface StripeConfig {
  publishableKey: string;
  secretKey?: string;
}

export interface CreateCheckoutSessionParams {
  priceId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CustomerPortalParams {
  customerId: string;
  returnUrl: string;
}

class StripeService {
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    this.config = config;
  }

  // Create checkout session for subscription
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ url: string }> {
    try {
      // In production, this should be an API call to your backend
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      return await response.json();
    } catch (error) {
      console.error('Stripe checkout error:', error);
      throw error;
    }
  }

  // Create customer portal session
  async createPortalSession(params: CustomerPortalParams): Promise<{ url: string }> {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      return await response.json();
    } catch (error) {
      console.error('Stripe portal error:', error);
      throw error;
    }
  }

  // Handle subscription webhooks
  async handleWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    console.log('Subscription created:', subscription.id);
    // TODO: Update user subscription in database
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    console.log('Subscription updated:', subscription.id);
    // TODO: Update user subscription in database
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    console.log('Subscription deleted:', subscription.id);
    // TODO: Update user subscription in database
  }

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    console.log('Payment succeeded:', invoice.id);
    // TODO: Update payment records
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    console.log('Payment failed:', invoice.id);
    // TODO: Handle failed payment
  }
}

// Initialize Stripe service
export const stripeService = new StripeService({
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...', // Test key
  secretKey: process.env.STRIPE_SECRET_KEY, // Should only be used server-side
});

export default stripeService;