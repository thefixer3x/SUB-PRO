/**
 * S202 — billing/success screen renders and the hook has refreshTier.
 * (Detailed deny-by-default and tier-loading tests are in useSubscription.test.tsx)
 *
 * Imports from testing-library at module level to avoid Jest hook errors.
 */
import React from 'react';
import { render, renderHook } from '@testing-library/react-native';

describe('billing/success refreshes tier', () => {
  it('success page renders with Payment Successful message', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BillingSuccess = require('@/app/billing/success').default;
    const { getByText } = render(<BillingSuccess />);
    expect(getByText('Payment Successful!')).toBeTruthy();
  });

  it('hook has refreshTier function available', () => {
    const mod = require('@/hooks/useSubscription');
    const { result } = renderHook(() => mod.useSubscriptionData(), {
      wrapper: ({ children }) => <mod.SubscriptionProvider>{children}</mod.SubscriptionProvider>,
    });

    expect(typeof result.current.refreshTier).toBe('function');
    expect(result.current.isLoading).toBe(true);
  });
});
