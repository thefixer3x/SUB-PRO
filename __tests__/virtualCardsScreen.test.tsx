import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';

const mockUseVirtualCardsEnabled = jest.fn();
const mockListCards = jest.fn();
const mockSetCardLocked = jest.fn();
const mockGetCardTransactions = jest.fn();
const mockConfirm = jest.fn();
const mockSetString = jest.fn();

jest.mock('@/hooks/useFeatureFlags', () => ({
  useVirtualCardsEnabled: () => mockUseVirtualCardsEnabled(),
}));

jest.mock('@/services/virtualCards', () => ({
  virtualCardService: {
    listCards: (...args: unknown[]) => mockListCards(...args),
    setCardLocked: (...args: unknown[]) => mockSetCardLocked(...args),
    getCardTransactions: (...args: unknown[]) => mockGetCardTransactions(...args),
  },
}));

jest.mock('@/components/cards/cardSecurity', () => ({
  confirmCardAction: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetString(...args),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ currentTier: 'free', canAccessFeature: () => false }),
}));

// eslint-disable-next-line import/first
import VirtualCardsScreen from '@/app/(tabs)/virtual-cards';

const renderScreen = () =>
  render(
    <ThemeProvider>
      <VirtualCardsScreen />
    </ThemeProvider>,
  );

// What the service hands the screen: display-safe fields only.
const activeCard = {
  id: 'ic_1',
  last4: '1111',
  brand: 'visa',
  status: 'active',
  expMonth: 3,
  expYear: 2029,
};

describe('Virtual Cards screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: false, isLoading: false });
    mockGetCardTransactions.mockResolvedValue([]);
    mockSetCardLocked.mockResolvedValue(undefined);
  });

  it('shows a coming soon screen and no card fields when the flag is off', () => {
    const { getAllByText, getByTestId, queryByText } = renderScreen();

    expect(getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(getByTestId('feature-card-virtual-cards')).toBeTruthy();
    expect(getByTestId('feature-card-card-freeze')).toBeTruthy();
    expect(queryByText('Open')).toBeNull();
    expect(queryByText(/••••/)).toBeNull();
    expect(mockListCards).not.toHaveBeenCalled();
  });

  it('renders last4, brand, status and expiry, and points to the web for full details', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([activeCard]);

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => expect(getByText('•••• 1111')).toBeTruthy());
    expect(getByText('VISA')).toBeTruthy();
    expect(getByText('ACTIVE')).toBeTruthy();
    expect(getByText('Expires 03/29')).toBeTruthy();
    // Native shows last4 only; Stripe's secure display is web-only.
    expect(getByText(/View full card details on the web/)).toBeTruthy();
    expect(queryByText(/CVC|CVV/)).toBeNull();
  });

  it('copies only the last 4 digits', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([activeCard]);
    const { getByLabelText } = renderScreen();

    await waitFor(() => getByLabelText('Copy last 4 digits'));
    fireEvent.press(getByLabelText('Copy last 4 digits'));
    await waitFor(() => expect(mockSetString).toHaveBeenCalledWith('1111'));
  });

  it('freezes a card only after the user confirms', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([activeCard]);
    mockConfirm.mockResolvedValue(true);
    const { getByLabelText } = renderScreen();

    await waitFor(() => getByLabelText('Freeze card'));
    fireEvent.press(getByLabelText('Freeze card'));

    await waitFor(() => expect(mockSetCardLocked).toHaveBeenCalledWith('ic_1', true));
    expect(mockConfirm).toHaveBeenCalledWith('Freeze card');
    // The list reloads to show the new state.
    await waitFor(() => expect(mockListCards).toHaveBeenCalledTimes(2));
  });

  it('does not change the card when confirmation is refused', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([activeCard]);
    mockConfirm.mockResolvedValue(false);
    const { getByLabelText, findByText } = renderScreen();

    await waitFor(() => getByLabelText('Freeze card'));
    fireEvent.press(getByLabelText('Freeze card'));

    expect(await findByText('Not confirmed. The card was not changed.')).toBeTruthy();
    expect(mockSetCardLocked).not.toHaveBeenCalled();
  });

  it('offers unfreeze for a frozen card', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([{ ...activeCard, status: 'inactive' }]);
    mockConfirm.mockResolvedValue(true);
    const { getByLabelText, getByText } = renderScreen();

    await waitFor(() => getByText('FROZEN'));
    fireEvent.press(getByLabelText('Unfreeze card'));
    await waitFor(() => expect(mockSetCardLocked).toHaveBeenCalledWith('ic_1', false));
  });

  it("shows the card's own transactions from the API", async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([activeCard]);
    mockGetCardTransactions.mockResolvedValue([
      {
        id: 'a1',
        amount: 1549,
        currency: 'usd',
        merchantName: 'Netflix',
        merchantCategory: null,
        approved: true,
        date: '2026-11-01T10:00:00Z',
        livemode: true,
      },
    ]);
    const { getByLabelText, findByText } = renderScreen();

    await waitFor(() => getByLabelText('Show transactions'));
    fireEvent.press(getByLabelText('Show transactions'));

    expect(await findByText('Netflix')).toBeTruthy();
    expect(await findByText('$15.49')).toBeTruthy();
    expect(mockGetCardTransactions).toHaveBeenCalledWith('ic_1');
  });

  it('shows an empty state when the user has no cards', async () => {
    mockUseVirtualCardsEnabled.mockReturnValue({ enabled: true, isLoading: false });
    mockListCards.mockResolvedValue([]);

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => expect(getByText('No virtual cards yet')).toBeTruthy());
    expect(queryByText(/••••/)).toBeNull();
  });
});
