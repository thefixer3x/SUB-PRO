import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionTier } from '@/types/monetization';
import { SUBSCRIPTION_PLANS } from '@/config/subscriptionPlans';
import { ApiHttpError, buildApiBases, requestWithFallback } from '@/lib/apiClient';

/** The Vercel function that creates a Stripe Checkout session. */
export const CHECKOUT_PATH = '/api/create-checkout-session';

/**
 * What the user sees when checkout cannot start. The raw error (status, URL,
 * server text) still goes to the console for debugging.
 */
export function checkoutErrorMessage(err: unknown): string {
  if (err instanceof ApiHttpError) {
    if (err.status === 401) return 'Your session has expired. Please sign in again, then choose your plan.';
    if (err.status === 400) return 'That plan is not available right now. Please contact support if this continues.';
    if (err.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'We could not open checkout. Please try again in a moment.';
}

const unique = <T,>(values: T[]): T[] => values.filter((value, index) => values.indexOf(value) === index);

export const usePayments = () => {
  const { user, session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  // Synchronous guard: state updates are async, so two quick taps could both
  // see isLoading === false and create two checkout sessions.
  const inFlight = useRef(false);

  const startUpgrade = useCallback(async (targetTier?: SubscriptionTier) => {
    if (inFlight.current) return;
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
      ].filter((value): value is string => Boolean(value))
    );

    if (!directUrls.length && !baseCandidates.length && !includeRelative) {
      setError('Payment endpoint configuration is missing.');
      return;
    }

    const tier = targetTier ?? 'pro';
    if (!SUBSCRIPTION_PLANS[tier] || tier === 'free') {
      setError('Choose Pro or Team to upgrade.');
      return;
    }

    inFlight.current = true;
    setPendingTier(tier);
    setIsLoading(true);

    try {
      const data = await requestWithFallback<{ url: string }>(
        CHECKOUT_PATH,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            email: (user as any).email || user.id,
            plan: tier,
          }),
        },
        {
          // Candidates: configured URLs, then each configured base, then the
          // same-origin path on web.
          bases: baseCandidates,
          urls: directUrls,
          allowRelative: includeRelative,
          // Only move on when the endpoint is missing. Any other answer
          // (401, 400, 500) is final, so one tap never creates two sessions.
          tryNextOnStatus: (status) => status === 404 || status === 405,
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
      setError(checkoutErrorMessage(err));
      console.error('Payment error:', err);
    } finally {
      inFlight.current = false;
      setPendingTier(null);
      setIsLoading(false);
    }
  }, [user, session]);

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
    pendingTier,
    error,
    clearError: () => setError(null),
  };
};
