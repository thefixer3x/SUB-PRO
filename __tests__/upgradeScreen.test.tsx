/**
 * Upgrade screen: plan choice is an explicit button per plan, it shows
 * progress on the chosen plan, locks the other buttons while checkout
 * starts, and shows payment errors on screen.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import UpgradeScreen from '@/app/(tabs)/upgrade';

const mockPayments = {
  startUpgrade: jest.fn(async () => {}),
  openCustomerPortal: jest.fn(async () => {}),
  clearError: jest.fn(),
  isLoading: false,
  pendingTier: null as string | null,
  error: null as string | null,
};

jest.mock('@/hooks/usePayments', () => ({ usePayments: () => mockPayments }));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ currentTier: 'free', subscription: null }),
}));
jest.mock('@/components/monetization/PlanComparison', () => ({ PlanComparison: () => null }));

describe('UpgradeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockPayments, { isLoading: false, pendingTier: null, error: null });
  });

  it('starts checkout for the plan whose button was pressed', () => {
    render(<UpgradeScreen />);
    fireEvent.press(screen.getByTestId('select-plan-team'));
    expect(mockPayments.startUpgrade).toHaveBeenCalledWith('team');

    fireEvent.press(screen.getByTestId('select-plan-pro'));
    expect(mockPayments.startUpgrade).toHaveBeenCalledWith('pro');
  });

  it('labels each plan button with its action and price', () => {
    render(<UpgradeScreen />);
    expect(screen.getByLabelText('Choose Pro, $10 per month')).toBeTruthy();
    expect(screen.getByLabelText('Choose Team, $20 per month')).toBeTruthy();
  });

  it('shows progress on the chosen plan and disables every plan button', () => {
    Object.assign(mockPayments, { isLoading: true, pendingTier: 'pro' });
    render(<UpgradeScreen />);

    expect(screen.getByText('Opening checkout…')).toBeTruthy();
    expect(screen.getByTestId('select-plan-pro').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(screen.getByTestId('select-plan-team').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(screen.getByTestId('select-plan-team'));
    expect(mockPayments.startUpgrade).not.toHaveBeenCalled();
  });

  it('shows a payment error and lets the user dismiss it', () => {
    mockPayments.error = 'We could not open checkout. Please try again in a moment.';
    render(<UpgradeScreen />);

    expect(screen.getByTestId('upgrade-error')).toBeTruthy();
    expect(screen.getByText(mockPayments.error)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Dismiss error'));
    expect(mockPayments.clearError).toHaveBeenCalled();
  });
});
