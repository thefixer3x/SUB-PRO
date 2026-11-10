/**
 * The add-subscription form saves a real row for the signed-in user, and the
 * Free plan cap is checked against the user's real list.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const USER_ID = '11111111-1111-4111-8111-111111111111';
let mockSubs: Array<{ id: string }> = [];
let mockTier = 'free';
const mockCreate = jest.fn();
const mockInvalidate = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: USER_ID } }) }));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ currentTier: mockTier, canAccessFeature: () => mockTier !== 'free' }),
}));
jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ data: mockSubs, isLoading: false, error: null }),
  useInvalidateSubscriptions: () => mockInvalidate,
}));
jest.mock('@/services/subscriptionService', () => ({
  createSubscription: (...args: unknown[]) => mockCreate(...args),
}));

// eslint-disable-next-line import/first
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';

beforeEach(() => {
  mockSubs = [];
  mockTier = 'free';
  mockCreate.mockReset().mockResolvedValue({ id: 'new' });
  mockInvalidate.mockReset();
  mockPush.mockReset();
});

describe('Add subscription', () => {
  it('saves the subscription for the signed-in user and refreshes the list', async () => {
    const onClose = jest.fn();
    render(<AddSubscriptionModal visible onClose={onClose} />);

    fireEvent.changeText(screen.getByLabelText('Service name'), 'Spotify');
    fireEvent.changeText(screen.getByLabelText('Amount per billing cycle'), '10.99');
    fireEvent.press(screen.getByText('Annually'));
    fireEvent.changeText(screen.getByLabelText('Next renewal date'), '2027-01-15');
    fireEvent.press(screen.getByLabelText('Save subscription'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [userId, sub] = mockCreate.mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(sub).toMatchObject({ name: 'Spotify', monthlyCost: 10.99, billingCycle: 'Annually', currency: 'USD' });
    expect(sub.renewalDate.toISOString().slice(0, 10)).toBe('2027-01-15');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('does not save an invalid form', async () => {
    render(<AddSubscriptionModal visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Save subscription'));
    expect(await screen.findByText('Enter the service name.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows the error and stays open when saving fails', async () => {
    mockCreate.mockRejectedValue(new Error('permission denied'));
    const onClose = jest.fn();
    render(<AddSubscriptionModal visible onClose={onClose} />);
    fireEvent.changeText(screen.getByLabelText('Service name'), 'Spotify');
    fireEvent.changeText(screen.getByLabelText('Amount per billing cycle'), '10.99');
    fireEvent.press(screen.getByLabelText('Save subscription'));
    expect(await screen.findByText('permission denied')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on the Free plan with 5 subscriptions, offers the plans instead of the form', () => {
    mockSubs = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
    render(<AddSubscriptionModal visible onClose={jest.fn()} />);
    expect(screen.getByText('Free plan limit reached')).toBeTruthy();
    expect(screen.queryByLabelText('Save subscription')).toBeNull();
    fireEvent.press(screen.getByText('See plans'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/upgrade');
  });

  it('on Pro, the cap does not apply', () => {
    mockTier = 'pro';
    mockSubs = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
    render(<AddSubscriptionModal visible onClose={jest.fn()} />);
    expect(screen.getByLabelText('Save subscription')).toBeTruthy();
  });
});
