import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionTier } from '@/types/monetization';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { buildApiBases, requestWithFallback } from '@/lib/apiClient';

const unique = <T,>(values: T[]): T[] => values.filter((value, index) => values.indexOf(value) === index);

export const usePayments = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startUpgrade = useCallback(async (targetTier?: SubscriptionTier) => {
    setError(null);

    if (!user?.id) {
      setError('You must be logged in to upgrade.');
      return;
    }

    const includeRelative = Platform.OS === 'web' && typeof window !== 'undefined';
    const baseCandidates = buildApiBases(
      [
        process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL,
        process.env.EXPO_PUBLIC_CHECKOUT_FALLBACK_BASE_URL,
        process.env.EXPO_PUBLIC_API_BASE_URL,
        process.env.EXPO_PUBLIC_API_FALLBACK_URL,
      ],
      { includeRelative: false }
    );

    const directUrls = unique(
      [
        process.env.EXPO_PUBLIC_CHECKOUT_URL?.trim(),
        process.env.EXPO_PUBLIC_CHECKOUT_FALLBACK_URL?.trim(),
        includeRelative ? '/api/create-checkout-session' : null,
      ].filter((value): value is string => Boolean(value))
    );

    if (!directUrls.length && !baseCandidates.length && !includeRelative) {
      setError('Payment endpoint configuration is missing.');
      return;
    }

    setIsLoading(true);

    try {
      const plan = targetTier ? SUBSCRIPTION_PLANS[targetTier] : SUBSCRIPTION_PLANS['pro'];

      const data = await requestWithFallback<{ url: string }>(
        '/create-checkout-session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: (user as any).email || user.id,
            plan: targetTier ?? 'pro',
          }),
        },
        {
          bases: baseCandidates,
          urls: directUrls,
          allowRelative: includeRelative,
        }
      );

      if (!data.url) {
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe Checkout
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url, {
          enableBarCollapsing: true,
          showTitle: true,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      console.error('Payment error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const openCustomerPortal = useCallback(async () => {
    setError(null);

    if (!user?.id) {
      setError('You must be logged in.');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement customer portal endpoint
      const message = 'Customer portal coming soon. Please contact support.';
      setError(message);
      console.warn('Portal not yet implemented');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open portal';
      setError(message);
      console.error('Portal error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const cancelSubscription = useCallback(async () => {
    setError(null);

    if (!user?.id) {
      setError('You must be logged in.');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement cancellation endpoint
      const message = 'Cancellation via portal coming soon. Please contact support.';
      setError(message);
      console.warn('Cancellation not yet implemented');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cancellation failed';
      setError(message);
      console.error('Cancellation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    startUpgrade,
    openCustomerPortal,
    cancelSubscription,
    isLoading,
    error,
    clearError: () => setError(null),
  };
};