/**
 * The Subscriptions screen shows only real actions. Features that are not
 * built yet are named as "Coming soon", never run with simulated data.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockCanAccess = false;

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' } }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    currentTier: mockCanAccess ? 'pro' : 'free',
    canAccessFeature: () => mockCanAccess,
    getRemainingLimit: () => (mockCanAccess ? null : 4),
  }),
}));
jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({
    data: [
      {
        id: 'sub-1',
        name: 'Netflix',
        monthlyCost: 15.49,
        currency: 'USD',
        billingCycle: 'Monthly',
        renewalDate: new Date('2026-12-01'),
        planName: 'Standard',
        status: 'Active',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useInvalidateSubscriptions: () => jest.fn(),
}));
jest.mock('@/components/monetization/AdBanner', () => ({ AdBanner: () => null }));
jest.mock('@/components/branding/PoweredByLanOnasis', () => ({ PoweredByLanOnasis: () => null }));
jest.mock('@/components/SubscriptionLogo', () => ({ SubscriptionLogo: () => null }));
jest.mock('@/components/social/ShareSubscriptionModal', () => ({ ShareSubscriptionModal: () => null }));
jest.mock('@/components/embeddedFinance/SmartNotifications', () => ({
  SmartNotifications: () => {
    throw new Error('SmartNotifications must not render: it shows simulated alerts');
  },
}));
jest.mock('@/components/embeddedFinance/AIAssistant', () => ({
  AIAssistant: () => {
    throw new Error('AIAssistant must not render: it uses simulated usage data');
  },
}));

// eslint-disable-next-line import/first
import Subscriptions from '@/app/(tabs)/subscriptions';

beforeEach(() => {
  mockPush.mockReset();
  mockCanAccess = false;
});

describe('Subscriptions screen', () => {
  it('lists the subscription with its billing cycle and no simulated actions', () => {
    render(<Subscriptions />);
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText(' / month')).toBeTruthy();
    expect(screen.queryByText('Cancel via Bot')).toBeNull();
    expect(screen.queryByText('Open AI Assistant')).toBeNull();
    expect(screen.queryByText('Switch Plan')).toBeNull();
    expect(screen.getByText(/Coming soon: Virtual cards/)).toBeTruthy();
  });

  it('sends a Free user to the plans when they tap Share', () => {
    render(<Subscriptions />);
    fireEvent.press(screen.getByLabelText('Share Netflix'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/upgrade');
  });

  it('lets a Pro user share without being sent to the plans', () => {
    mockCanAccess = true;
    render(<Subscriptions />);
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.queryByText('Share (Pro)')).toBeNull();
    fireEvent.press(screen.getByLabelText('Share Netflix'));
    expect(mockPush).not.toHaveBeenCalledWith('/(tabs)/upgrade');
  });

  it('opens the add form from the + button', () => {
    render(<Subscriptions />);
    fireEvent.press(screen.getByLabelText('Add subscription'));
    expect(screen.getByLabelText('Service name')).toBeTruthy();
  });

  it('links the coming-soon line to the features hub', () => {
    render(<Subscriptions />);
    fireEvent.press(screen.getByLabelText('See what is coming for your subscriptions'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/features');
  });
});
