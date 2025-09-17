import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PASSWORD_REQUIREMENTS } from '@/constants/auth';
import SignInPage from '@/app/(auth)/signin';
import SignUpPage from '@/app/(auth)/signup';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/branding/PoweredByLanOnasis', () => ({
  PoweredByLanOnasis: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Authentication Screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      signIn: jest.fn(),
      signUp: jest.fn(),
      authLoading: false,
    });
  });

  it('validates password strength', async () => {
    const signUpMock = jest.fn();
    mockUseAuth.mockReturnValue({ signUp: signUpMock, authLoading: false });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByPlaceholderText, getByText, getByTestId } = render(<SignUpPage />);

    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Jane Doe');
    fireEvent.changeText(getByPlaceholderText('Email Address'), 'jane@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'weak');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'weak');

    fireEvent.press(getByText('I agree to the Terms of Service and Privacy Policy'));

    await act(async () => {
      fireEvent.press(getByTestId('sign-up-submit'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Weak Password', PASSWORD_REQUIREMENTS);
    expect(signUpMock).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('handles network errors gracefully', async () => {
    const signInMock = jest.fn().mockResolvedValue({ success: false, error: 'Network request failed' });
    mockUseAuth.mockReturnValue({ signIn: signInMock, authLoading: false });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByPlaceholderText, getByText, getByTestId } = render(<SignInPage />);

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'jane@example.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password123');

    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Network Error',
        'We were unable to connect. Please check your internet connection and try again.',
      );
    });

    alertSpy.mockRestore();
  });

  it('redirects correctly after successful auth', async () => {
    const signInMock = jest.fn().mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue({ signIn: signInMock, authLoading: false });

    const { getByPlaceholderText, getByText, getByTestId } = render(<SignInPage />);

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Password123');

    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});

