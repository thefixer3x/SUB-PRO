import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import SharedGroupsScreen from '@/app/(tabs)/shared-groups';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-1' }, isInitializing: false, authLoading: false }),
}));

jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({
    data: [
      { id: '1', name: 'ClickUp', monthlyCost: 7 },
      { id: '2', name: 'Notion', monthlyCost: 10 },
    ],
    isLoading: false,
  }),
}));

jest.mock('@/services/sharedSubscriptions', () => ({
  sharedSubscriptionsService: {
    getUserSharedGroups: jest.fn(async () => []),
    getGroupMembers: jest.fn(async () => []),
    createSharedGroup: jest.fn(async () => ({})),
  },
}));

const renderFreeTierScreen = () =>
  render(
    <SubscriptionProvider>
      <ThemeProvider>
        <SharedGroupsScreen />
      </ThemeProvider>
    </SubscriptionProvider>,
  );

describe('Shared Groups screen on the free plan', () => {
  it('shows the upgrade prompt instead of the share flow', async () => {
    renderFreeTierScreen();

    await waitFor(() => {
      expect(
        screen.getByText(/Subscription sharing is available on Pro and Team plans/),
      ).toBeTruthy();
    });

    // The sharing UI is never mounted for a free account.
    expect(screen.queryByText('Create a Shared Group')).toBeNull();
    expect(screen.queryByText('Shared Subscriptions')).toBeNull();
    expect(screen.queryByText('Share')).toBeNull();
  });
});
