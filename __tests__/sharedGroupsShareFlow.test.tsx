import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import SharedGroupsScreen from '@/app/(tabs)/shared-groups';
import { ThemeProvider } from '@/contexts/ThemeContext';

let mockTier: 'free' | 'pro' | 'team' = 'pro';
let mockSubscriptions = [
  { id: '1', name: 'ClickUp', monthlyCost: 7 },
  { id: '2', name: 'Notion', monthlyCost: 10 },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-1' }, isInitializing: false, authLoading: false }),
}));

// Only the signed-in tier is injected here: the entitlement itself is resolved from the
// real plan table, exactly as useSubscription().canAccessFeature does.
jest.mock('@/hooks/useSubscription', () => {
  const actual = jest.requireActual('@/hooks/useSubscription');
  const { SUBSCRIPTION_PLANS } = jest.requireActual('@/config/subscriptionPlans');
  return {
    ...actual,
    useSubscription: () => ({
      currentTier: mockTier,
      subscription: null,
      isLoading: false,
      canAccessFeature: (feature: string) => {
        const limit = SUBSCRIPTION_PLANS[mockTier].limits[feature];
        if (limit === null || limit === true) return true;
        if (limit === false) return false;
        return true;
      },
      getRemainingLimit: () => null,
      upgradeRequired: () => {},
    }),
  };
});

jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ data: mockSubscriptions, isLoading: false }),
}));

jest.mock('@/services/sharedSubscriptions', () => ({
  sharedSubscriptionsService: {
    getUserSharedGroups: jest.fn(async () => []),
    getGroupMembers: jest.fn(async () => []),
    createSharedGroup: jest.fn(async () => ({})),
  },
}));

const renderScreen = () => {
  const utils = render(
    <ThemeProvider>
      <SharedGroupsScreen />
    </ThemeProvider>,
  );
  return utils;
};

describe('Shared Groups share flow', () => {
  beforeEach(() => {
    mockTier = 'pro';
    mockSubscriptions = [
      { id: '1', name: 'ClickUp', monthlyCost: 7 },
      { id: '2', name: 'Notion', monthlyCost: 10 },
    ];
  });

  it('opens the share modal for the subscription the user chooses', async () => {
    renderScreen();

    fireEvent.press(await screen.findByText('Create a Shared Group'));

    // Nothing is selected yet, so the share modal is not open.
    expect(screen.queryByText('Share Subscription')).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Choose a Subscription')).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText('Share')[0]);

    await waitFor(() => {
      expect(screen.getByText('Share Subscription')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('ClickUp Group')).toBeTruthy();
    expect(screen.getByText('$7.00/month')).toBeTruthy();
  }, 20000);

  it('closes the share modal when the chosen subscription goes away', async () => {
    const { rerender } = renderScreen();

    fireEvent.press(await screen.findByText('Create a Shared Group'));
    await waitFor(() => {
      expect(screen.getByText('Choose a Subscription')).toBeTruthy();
    });
    fireEvent.press(screen.getAllByText('Share')[0]);
    await waitFor(() => {
      expect(screen.getByText('Share Subscription')).toBeTruthy();
    });

    mockSubscriptions = [];
    rerender(
      <ThemeProvider>
        <SharedGroupsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Share Subscription')).toBeNull();
    });
  });

  it('reloads the shared groups list when the share modal closes', async () => {
    const { act } = require('@testing-library/react-native');
    const { sharedSubscriptionsService } = require('@/services/sharedSubscriptions');
    const { ShareSubscriptionModal } = require('@/components/social/ShareSubscriptionModal');
    const loadGroups = sharedSubscriptionsService.getUserSharedGroups as jest.Mock;
    loadGroups.mockClear();

    renderScreen();

    fireEvent.press(await screen.findByText('Create a Shared Group'));
    await waitFor(() => {
      expect(screen.getByText('Choose a Subscription')).toBeTruthy();
    });
    fireEvent.press(screen.getAllByText('Share')[0]);
    await waitFor(() => {
      expect(screen.getByText('Share Subscription')).toBeTruthy();
    });

    const callsBeforeClose = loadGroups.mock.calls.length;

    // The modal may have created a group before closing, so closing it must refetch the
    // list rather than leave the stale snapshot SharedGroupsDisplay captured on mount.
    act(() => {
      screen.UNSAFE_getByType(ShareSubscriptionModal).props.onClose();
    });

    await waitFor(() => {
      expect(loadGroups.mock.calls.length).toBeGreaterThan(callsBeforeClose);
    });
  });
});
