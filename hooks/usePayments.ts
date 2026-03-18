import { useState } from 'react';
import { Platform, Linking } from 'react-native';
import stripeService from '@/services/stripe';
import { SubscriptionTier } from '@/types/monetization';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';

export const usePayments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startUpgrade = async (targetTier: SubscriptionTier) => {
    try {
      setIsLoading(true);
      setError(null);

      const plan = SUBSCRIPTION_PLANS[targetTier];
      
      if (!plan.stripePriceId) {
        throw new Error('Plan not available for purchase');
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession({
        priceId: plan.stripePriceId,
        successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/subscription/canceled`,
        metadata: {
          userId: 'current-user-id', // TODO: Get from auth context
          targetTier,
        },
      });

      // Redirect to Stripe Checkout
      if (Platform.OS === 'web') {
        window.location.href = session.url;
      } else {
        await Linking.openURL(session.url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      console.error('Payment error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const portal = await stripeService.createPortalSession({
        customerId: 'current-customer-id', // TODO: Get from user context
        returnUrl: window.location.origin,
      });

      // Redirect to Stripe Customer Portal
      if (Platform.OS === 'web') {
        window.location.href = portal.url;
      } else {
        await Linking.openURL(portal.url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open portal';
      setError(message);
      console.error('Portal error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // In production, make API call to cancel subscription
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'current-user-id', // TODO: Get from auth context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      // TODO: Update local state and refresh user data
      console.log('Subscription canceled successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancellation failed';
      setError(message);
      console.error('Cancellation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    startUpgrade,
    openCustomerPortal,
    cancelSubscription,
    isLoading,
    error,
    clearError: () => setError(null),
  };
};