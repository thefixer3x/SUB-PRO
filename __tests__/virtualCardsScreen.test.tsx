import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';

const mockUseVirtualCardsEnabled = jest.fn();
const mockGetCardsByUser = jest.fn();
const mockUpdateVirtualCard = jest.fn();

jest.mock('@/hooks/useFeatureFlags', () => ({
  useVirtualCardsEnabled: () => mockUseVirtualCardsEnabled(),
}));

jest.mock('@/services/virtualCards', () => ({
  virtualCardService: {
    getCardsByUser: (...args: unknown[]) => mockGetCardsByUser(...args),
    updateVirtualCard: (...args: unknown[]) => mockUpdateVirtualCard(...args),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import VirtualCardsScreen from '@/app/(tabs)/virtual-cards';

const renderScreen = () =>
  render(
    <ThemeProvider>
      <VirtualCardsScreen />
    </ThemeProvider>
  );

// A card payload that carries fields the screen must never render. The values
// are deliberately not card-number-shaped so nothing here can be mistaken for a
// real card number.
const cardPayload = {
  cards: [
    {
      id: 'card-1',
      last4: '1111',
      brand: 'visa',
      status: 'active',
      cardNumber: 'MUST-NOT-RENDER-CARD-NUMBER',
      cvv: 'MUST-NOT-RENDER-CVV',
      expiryMonth: 12,
      expiryYear: 2030,
    },
  ],
};

describe('Virtual Cards screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: false, isLoading: false });
  });

  it('shows a coming soon screen and no card fields when the flag is off', () => {
    const { getByText, queryByText } = renderScreen();

    expect(getByText('Coming soon')).toBeTruthy();
    expect(queryByText(/MUST-NOT-RENDER/)).toBeNull();
    expect(queryByText(/••••/)).toBeNull();
    expect(queryByText('ACTIVE')).toBeNull();
    expect(mockGetCardsByUser).not.toHaveBeenCalled();
  });

  it('renders only last4, brand and status from the service when the flag is on', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockGetCardsByUser.mockResolvedValue(cardPayload);

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => expect(getByText('•••• 1111')).toBeTruthy());

    expect(getByText('VISA')).toBeTruthy();
    expect(getByText('ACTIVE')).toBeTruthy();

    // No card number, CVV or expiry is ever rendered.
    expect(queryByText(/MUST-NOT-RENDER/)).toBeNull();
    expect(queryByText('12/2030')).toBeNull();
    expect(queryByText(/CVV/i)).toBeNull();
    expect(queryByText(/Copy Number/i)).toBeNull();
  });

  it('tells the user card details are not available yet', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockGetCardsByUser.mockResolvedValue(cardPayload);

    const { getByText } = renderScreen();

    await waitFor(() =>
      expect(getByText('Card details are shown securely in a later update')).toBeTruthy()
    );
  });

  it('shows an empty state when the user has no cards', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockGetCardsByUser.mockResolvedValue({ cards: [] });

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => expect(getByText('No virtual cards yet')).toBeTruthy());
    expect(queryByText(/••••/)).toBeNull();
  });

  it('shows an empty state for transactions instead of an empty list presented as data', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockGetCardsByUser.mockResolvedValue(cardPayload);

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => expect(getByText('Recent Transactions')).toBeTruthy());
    expect(getByText('No transactions to show yet')).toBeTruthy();
    expect(queryByText(/Netflix|Spotify|Adobe/)).toBeNull();
  });
});
