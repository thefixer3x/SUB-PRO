import React, { useEffect } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { AppState, type AppStateEvent, type AppStateStatus } from 'react-native';
import { supabase as mockedSupabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthValue = ReturnType<typeof useAuth>;

const unsubscribeMock = jest.fn();
let mockAppStateHandler: ((state: AppStateStatus) => void) | null = null;
const mockRemoveListener = jest.fn();
const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
addEventListenerSpy.mockImplementation((_event: AppStateEvent, handler: (state: AppStateStatus) => void) => {
  mockAppStateHandler = handler;
  return { remove: mockRemoveListener };
});

const mockSupabaseAuth = {
  getSession: jest.fn(),
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChange: jest.fn(),
};
const mockSupabaseFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  },
}));

const AuthConsumer = ({ onReady }: { onReady: (value: AuthValue) => void }) => {
  const value = useAuth();

  useEffect(() => {
    onReady(value);
  }, [onReady, value]);

  return null;
};

describe('AuthContext', () => {
  beforeEach(() => {
    mockAppStateHandler = null;
    unsubscribeMock.mockReset();
    mockRemoveListener.mockReset();
    addEventListenerSpy.mockClear();
    addEventListenerSpy.mockImplementation((_event: AppStateEvent, handler: (state: AppStateStatus) => void) => {
      mockAppStateHandler = handler;
      return { remove: mockRemoveListener };
    });

    Object.values(mockSupabaseAuth).forEach((fn) => {
      if (typeof fn.mockReset === 'function') {
        fn.mockReset();
      }
    });
    mockSupabaseFrom.mockReset();

    (mockedSupabase as unknown as { auth: unknown; from: unknown }).auth = mockSupabaseAuth as unknown;
    (mockedSupabase as unknown as { auth: unknown; from: unknown }).from = mockSupabaseFrom as unknown;

    mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });
    mockSupabaseFrom.mockImplementation(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }));
  });

  it('handles profile creation failure during signup', async () => {
    const profileError = { message: 'duplicate key' };
    const upsertMock = jest.fn().mockResolvedValue({ error: profileError });
    mockSupabaseFrom.mockReturnValueOnce({ upsert: upsertMock });

    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' } as unknown as User,
    } as Session;

    mockSupabaseAuth.signUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: mockSession },
      error: null,
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let authValue: AuthValue | null = null;

    render(
      <AuthProvider>
        <AuthConsumer onReady={(value) => {
          authValue = value;
        }} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(authValue).not.toBeNull();
    });

    await act(async () => {
      const result = await authValue!.signUp({
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'Test User',
      });

      expect(result.success).toBe(true);
      expect(result.requiresEmailConfirmation).toBe(false);
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        full_name: 'Test User',
      }),
      { onConflict: 'id' },
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to create profile after sign up',
      profileError,
    );
    warnSpy.mockRestore();
  });

  it('properly cleans up on unmount', async () => {
    mockSupabaseAuth.onAuthStateChange.mockReturnValueOnce({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    });

    const { unmount } = render(
      <AuthProvider>
        <AuthConsumer onReady={() => {}} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
    expect(mockRemoveListener).toHaveBeenCalled();
  });

  it('refreshes session on app focus', async () => {
    let latestAuthValue: AuthValue | null = null;

    render(
      <AuthProvider>
        <AuthConsumer onReady={(value) => {
          latestAuthValue = value;
        }} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(latestAuthValue).not.toBeNull();
      expect(addEventListenerSpy).toHaveBeenCalled();
    });

    expect(mockSupabaseAuth.getSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockAppStateHandler?.('active');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalledTimes(2);
    });
  });

  afterAll(() => {
    addEventListenerSpy.mockRestore();
  });
});
