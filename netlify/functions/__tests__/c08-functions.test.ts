/**
 * Tests for the C08 server-side proxies (hibp-check, splitwise-api).
 * Auth is mocked at the shared helper; no live services are called.
 */

const mockRequireUser = jest.fn();

jest.mock('../_shared/auth', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

import { handler as hibpHandler } from '../hibp-check';
import { handler as splitwiseHandler } from '../splitwise-api';

const ORIGIN = 'https://sub-pro.lanonasis.com';

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  httpMethod: 'GET',
  path: '/.netlify/functions/hibp-check',
  headers: { origin: ORIGIN, authorization: 'Bearer token' },
  queryStringParameters: null,
  body: null,
  ...overrides,
});

const unauthorized = {
  ok: false,
  response: { statusCode: 401, headers: {}, body: JSON.stringify({ error: 'Authentication required' }) },
};

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

describe('hibp-check', () => {
  it('returns the auth helper response (401) without calling HIBP', async () => {
    mockRequireUser.mockResolvedValue(unauthorized);
    const result = await hibpHandler(makeEvent() as never);
    expect(result.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the session email and ignores an email in the query', async () => {
    mockRequireUser.mockResolvedValue(signedIn('me@example.com'));
    fetchMock.mockResolvedValue({ status: 404, ok: false });

    const result = await hibpHandler(
      makeEvent({ queryStringParameters: { email: 'someone-else@example.com' } }) as never,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).breached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('me@example.com'));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('someone-else');
  });

  it('returns 503 when the API key is not configured', async () => {
    delete process.env.HAVEIBEENPWNED_API_KEY;
    mockRequireUser.mockResolvedValue(signedIn());
    const result = await hibpHandler(makeEvent() as never);
    expect(result.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown origin', async () => {
    const result = await hibpHandler(makeEvent({ headers: { origin: 'https://evil.example' } }) as never);
    expect(result.statusCode).toBe(403);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });
});

describe('splitwise-api', () => {
  it('returns 401 without a valid session', async () => {
    mockRequireUser.mockResolvedValue(unauthorized);
    const result = await splitwiseHandler(makeEvent({ httpMethod: 'POST' }) as never);
    expect(result.statusCode).toBe(401);
  });

  it('is disabled (501) for signed-in users and never calls Splitwise', async () => {
    mockRequireUser.mockResolvedValue(signedIn());
    const result = await splitwiseHandler(
      makeEvent({ httpMethod: 'POST', body: JSON.stringify({ action: 'delete_group', groupId: 1 }) }) as never,
    );
    expect(result.statusCode).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
