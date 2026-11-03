import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetSession = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  isSupabaseEnvConfigured: true,
}));

import { useVirtualCardsEnabled } from '@/hooks/useFeatureFlags';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({
      // The gate must resolve in one attempt; the default 3 retries would keep
      // the query pending and hide the fail-closed behaviour under test.
      defaultOptions: { queries: { retry: false } },
    })}
  >
    {children}
  </QueryClientProvider>
);

describe('useVirtualCardsEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockSelect.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('is off when the flag row is missing', async () => {
    const { result } = renderHook(() => useVirtualCardsEnabled(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it('is off when the flag row is present but disabled', async () => {
    mockSelect.mockResolvedValue({
      data: [{ name: 'virtualCardsEnabled', enabled: false }],
      error: null,
    });

    const { result } = renderHook(() => useVirtualCardsEnabled(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it('is on only when the flag row enables it', async () => {
    mockSelect.mockResolvedValue({
      data: [{ name: 'virtualCardsEnabled', enabled: true }],
      error: null,
    });

    const { result } = renderHook(() => useVirtualCardsEnabled(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(true);
  });

  it('stays off when the flag lookup fails', async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });

    const { result } = renderHook(() => useVirtualCardsEnabled(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });
});
