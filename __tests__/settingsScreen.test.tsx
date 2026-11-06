/**
 * Settings: the export contains the user's own subscriptions, notification
 * toggles survive a remount, the currency picker works without Alert.alert,
 * and the rows with nowhere to go (Date Format, Help) are gone.
 *
 * Only dependencies are mocked; the screen and usePreferences are real.
 */
import React from 'react';
import { Linking, Platform, Share, Switch } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBS = [
  { id: 's1', name: 'Netflix', monthlyCost: 15.99, currency: 'USD', status: 'Active' },
  { id: 's2', name: 'Spotify', monthlyCost: 9.99, currency: 'USD', status: 'Active' },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '11111111-1111-4111-8111-111111111111', email: 'me@example.com', user_metadata: { full_name: 'Me' } },
    signOut: jest.fn(async () => ({ success: true })),
  }),
}));

jest.mock('@/hooks/useSubscriptions', () => ({
  useSubscriptions: () => ({ data: SUBS, isLoading: false }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
  }),
}));

jest.mock('@/components/ThemeSelector', () => ({ ThemeSelector: () => null }));
jest.mock('@/components/BudgetAlertRow', () => ({ BudgetAlertRow: () => null }));
jest.mock('@/hooks/useBudgetAlert', () => ({
  useBudgetAlert: () => ({ enabled: false, budgetLimit: 0, setBudgetEnabled: jest.fn(), setBudgetLimit: jest.fn() }),
}));
jest.mock('@/components/compliance/SecurityHealthBanner', () => ({ SecurityHealthBanner: () => null }));
jest.mock('@/components/compliance/SecurityDashboard', () => ({ SecurityDashboard: () => null }));
jest.mock('@/components/compliance/PrivacyCenter', () => ({ PrivacyCenter: () => null }));
jest.mock('@/components/branding/PoweredByLanOnasis', () => ({ PoweredByLanOnasis: () => null }));
jest.mock('@/services/securityMonitoring', () => ({
  securityMonitoringService: { getLatestHealthCheck: jest.fn(async () => null) },
}));

// eslint-disable-next-line import/first
import Settings from '@/app/(tabs)/settings';

const renderSettings = async () => {
  const view = render(<Settings />);
  // usePreferences loads from AsyncStorage on mount.
  await act(async () => {});
  return view;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  Platform.OS = 'ios';
  delete process.env.EXPO_PUBLIC_SUPPORT_URL;
  delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
});

describe('Settings', () => {
  it('exports the signed-in user\'s subscriptions', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await renderSettings();

    fireEvent.press(screen.getByText('Export Data'));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const payload = JSON.parse((shareSpy.mock.calls[0][0] as { message: string }).message);
    expect(payload.subscriptions.map((s: { id: string }) => s.id)).toEqual(['s1', 's2']);
    expect(payload.user.email).toBe('me@example.com');
    shareSpy.mockRestore();
  });

  it('keeps notification toggles after a remount', async () => {
    const first = await renderSettings();
    const toggle = first.UNSAFE_getAllByType(Switch)[0];
    expect(toggle.props.value).toBe(true);

    await act(async () => {
      toggle.props.onValueChange(false);
    });
    await waitFor(() => expect(first.UNSAFE_getAllByType(Switch)[0].props.value).toBe(false));
    first.unmount();

    const second = await renderSettings();
    await waitFor(() => expect(second.UNSAFE_getAllByType(Switch)[0].props.value).toBe(false));
  });

  it('changes the currency from an inline list', async () => {
    await renderSettings();

    fireEvent.press(screen.getByText('Currency'));
    fireEvent.press(screen.getByText('EUR — Euro'));

    await waitFor(() => expect(screen.getByText('EUR — Select currency')).toBeTruthy());
    expect(screen.queryByText('GBP — British Pound')).toBeNull();
  });

  it('has no rows that lead nowhere', async () => {
    await renderSettings();
    expect(screen.queryByText('Date Format')).toBeNull();
    expect(screen.queryByText('Help & Support')).toBeNull();
  });

  it('shows Help & Support when a support link is configured, and opens it', async () => {
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'help@example.com';
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderSettings();

    fireEvent.press(screen.getByText('Help & Support'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('mailto:help@example.com'));
    openSpy.mockRestore();
  });
});
