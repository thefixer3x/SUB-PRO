/**
 * useSubscriptions: demo accounts (non-UUID ids) get an empty list without a
 * database call; real account ids are queried.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSelect = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          order: async () => {
            mockSelect(table, column, value);
            return { data: [], error: null };
          },
        }),
      }),
    }),
  },
}));

// eslint-disable-next-line import/first
import { useSubscriptions } from '@/hooks/useSubscriptions';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => mockSelect.mockClear());

describe('useSubscriptions', () => {
  it('returns an empty list for the demo account without querying', async () => {
    const { result } = renderHook(() => useSubscriptions('mock-user-3cec2962-5590-4800-b568-2bdcb08b23d3'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('queries sm_subscriptions for a real account id', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const { result } = renderHook(() => useSubscriptions(id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSelect).toHaveBeenCalledWith('sm_subscriptions', 'user_id', id);
  });

  it('does nothing while signed out', () => {
    const { result } = renderHook(() => useSubscriptions(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
