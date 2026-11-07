/**
 * Tests for the Vercel api/ handlers (hibp-check, splitwise).
 *
 * Ported from netlify/functions/__tests__/c08-functions.test.ts after
 * the original Netlify functions were deleted (card S203).  Auth is
 * mocked at server/auth (used by the api/ layer), and handlers are
 * invoked with web Request objects instead of Netlify events.
 */

// ── mocks must be declared before imports; Jest hoists jest.mock() and
// ── import statements, so we declare mockRequireUser first and reference
// ── it by name in the mock factory (resolved at init, not at parse time).
const mockRequireUser = jest.fn();

jest.mock('../../../server/auth', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// eslint-disable-next-line import/order
import { handler as hibpHandler } from '../../../api/hibp-check';
// eslint-disable-next-line import/order
import { handler as splitwiseHandler } from '../../../api/splitwise';

const ORIGIN = 'https://sub-pro.lanonasis.com';

const signedIn = (email: string | null = 'me@example.com') => ({
  ok: true,
  user: { id: 'user-1', email, metadata: {} },
});

const fetchMock = jest.fn();

beforeEach(() => {
  process.env.ALLOWED_ORIGINS = ORIGIN;
  process.env.HAVEIBEENPWNED_API_KEY = 'test-hibp-key';
  mockRequireUser.mockReset();
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
});

describe('api/hibp-check handler', () => {
  it('returns 401 without a valid session', async () => {
    mockRequireUser.mockResolvedValue({
      ok: false,
      response: { statusCode: 401, headers: {}, body: JSON.stringify({ error: 'Authentication required' }) },
    });
    const req = new Request('https://placeholder/api/hibp-check', { method: 'POST', headers: { origin: ORIGIN } });
    const res = await hibpHandler(req);
    expect(res.status).toBe(401);
    expect(JSON.parse(await res.text()).error).toMatch(/authentication required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the session email and ignores an email in the query', async () => {
    mockRequireUser.mockResolvedValue(signedIn('me@example.com'));
    fetchMock.mockResolvedValue({ status: 404, ok: false, json: () => Promise.resolve([]) });

    const req = new Request('https://placeholder/api/hibp-check', { method: 'GET' });
    const res = await hibpHandler(req);

    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.breached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('me@example.com'));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('someone-else');
  });

  it('returns 503 when the API key is not configured', async () => {
    delete process.env.HAVEIBEENPWNED_API_KEY;
    mockRequireUser.mockResolvedValue(signedIn());
    const req = new Request('https://placeholder/api/hibp-check', { method: 'POST', headers: { origin: ORIGIN } });
    const res = await hibpHandler(req);
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown origin', async () => {
    const req = new Request('https://placeholder/api/hibp-check', { method: 'GET', headers: { origin: 'https://evil.example' } });
    const res = await hibpHandler(req);
    expect(res.status).toBe(403);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });
});

describe('api/splitwise handler', () => {
  it('returns 401 without a valid session', async () => {
    mockRequireUser.mockResolvedValue({
      ok: false,
      response: { statusCode: 401, headers: {}, body: JSON.stringify({ error: 'Authentication required' }) },
    });
    const req = new Request('https://placeholder/api/splitwise', { method: 'POST', headers: { origin: ORIGIN } });
    const res = await splitwiseHandler(req);
    expect(res.status).toBe(401);
  });

  it('is disabled (501) for signed-in users and never calls Splitwise', async () => {
    mockRequireUser.mockResolvedValue(signedIn());
    const req = new Request('https://placeholder/api/splitwise', { method: 'POST' });
    const res = await splitwiseHandler(req);
    expect(res.status).toBe(501);
    expect(JSON.parse(await res.text()).error).toBe('Splitwise integration is not available yet');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
