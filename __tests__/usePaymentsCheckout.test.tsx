/**
 * usePayments.startUpgrade: the payment stage of the upgrade flow.
 * - posts the chosen plan to /api/create-checkout-session (not /create-checkout-session)
 * - a real server answer (401, 500) is final: no second POST to another URL
 * - a second tap while the first request is in flight is ignored
 * - the user sees a readable message, not the raw status/URL text
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { usePayments, CHECKOUT_PATH } from '@/hooks/usePayments';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'u@example.test' },
    session: { access_token: 'token-1' },
  }),
}));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

const BASE = 'https://api.example.test';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('usePayments.startUpgrade', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts the chosen plan with the bearer token to the checkout function', async () => {
    fetchMock.mockResolvedValue(json(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
    const { result } = renderHook(() => usePayments());

    await act(async () => {
      await result.current.startUpgrade('team');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}${CHECKOUT_PATH}`);
    expect(CHECKOUT_PATH).toBe('/api/create-checkout-session');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body).plan).toBe('team');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://checkout.stripe.com/c/pay/cs_test_1',
      expect.any(Object),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not re-send to another URL after a real server answer', async () => {
    process.env.EXPO_PUBLIC_API_FALLBACK_URL = 'https://fallback.example.test';
    fetchMock.mockResolvedValue(json(401, { error: 'Authentication required' }));
    const { result } = renderHook(() => usePayments());

    await act(async () => {
      await result.current.startUpgrade('pro');
    });

    delete process.env.EXPO_PUBLIC_API_FALLBACK_URL;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatch(/sign in again/i);
  });

  it('shows a readable message for a server error, without the raw status or URL', async () => {
    fetchMock.mockResolvedValue(json(500, { error: 'Price not available (lookup_key=subtrack_pro_monthly)' }));
    const { result } = renderHook(() => usePayments());

    await act(async () => {
      await result.current.startUpgrade('pro');
    });

    expect(result.current.error).toBe('We could not open checkout. Please try again in a moment.');
    expect(result.current.error).not.toMatch(/500|lookup_key|http/i);
  });

  it('ignores a second tap while checkout is starting', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolveFetch = r; }));
    const { result } = renderHook(() => usePayments());

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.startUpgrade('pro');
      void result.current.startUpgrade('pro');
      void result.current.startUpgrade('team');
    });

    await waitFor(() => expect(result.current.pendingTier).toBe('pro'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(json(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_2' }));
      await first;
    });
    expect(result.current.pendingTier).toBeNull();
  });

  it('refuses the free tier as a checkout target', async () => {
    const { result } = renderHook(() => usePayments());
    await act(async () => {
      await result.current.startUpgrade('free');
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Pro or Team/);
  });
});
