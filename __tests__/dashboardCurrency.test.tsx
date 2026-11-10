/**
 * Dashboard: amounts in different currencies are never added together, and
 * the notice names what was left out instead of claiming a conversion.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

let mockSubs: Array<Record<string, unknown>> = [];

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'me@example.com', user_metadata: {} } }),
}));
jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ data: mockSubs, isLoading: false, error: null }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ currentTier: 'pro', canAccessFeature: () => true }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
jest.mock('@/components/monetization/UpgradeRibbon', () => ({ UpgradeRibbon: () => null }));
jest.mock('@/components/monetization/AdBanner', () => ({ AdBanner: () => null }));
jest.mock('@/components/monetization/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/branding/PoweredByLanOnasis', () => ({ PoweredByLanOnasis: () => null }));
jest.mock('@/components/PlanInbox', () => ({ PlanInbox: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/subscriptions/AddSubscriptionModal', () => ({ AddSubscriptionModal: () => null }));
jest.mock('@/components/features/FeaturePreviewCard', () => ({ FeaturePreviewCard: () => null }));

// eslint-disable-next-line import/first
import Dashboard from '@/app/(tabs)/index';

const sub = (id: string, monthlyCost: number, currency: string) => ({
  id,
  name: `Sub ${id}`,
  category: 'Entertainment',
  status: 'Active',
  planName: 'Basic',
  monthlyCost,
  currency,
  billingCycle: 'Monthly',
  renewalDate: new Date('2030-01-01T00:00:00Z'),
  paymentMethod: 'Card',
  priority: 'Medium',
});

describe('Dashboard totals', () => {
  it('sums only the main currency and names the rest', () => {
    mockSubs = [sub('a', 10, 'USD'), sub('b', 5, 'USD'), sub('c', 10, 'EUR')];
    render(<Dashboard />);

    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$25.00')).toBeNull();
    expect(screen.queryByText(/normalised to monthly USD/)).toBeNull();
    expect(screen.getByText(/Totals are in USD\. 1 subscription billed in EUR is not included/)).toBeTruthy();
    expect(screen.getByText('Multiple Currencies')).toBeTruthy();
  });

  it('shows no currency notice when everything is in one currency', () => {
    mockSubs = [sub('a', 10, 'NGN'), sub('b', 5, 'NGN')];
    render(<Dashboard />);
    expect(screen.queryByText('Multiple Currencies')).toBeNull();
  });
});
