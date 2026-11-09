import { handleP1Request } from '../server/p1-api';

const mockAuthenticate = jest.fn();
const mockGetConsent = jest.fn();
const mockGetUserTier = jest.fn();
const mockUpdateInsightStatus = jest.fn();
const mockListInsights = jest.fn();

jest.mock('@/server/p1-route', () => ({
  authenticateP1Route: (...args: unknown[]) => mockAuthenticate(...args),
  isUuid: (value: string) => /^[0-9a-f-]{36}$/i.test(value),
  jsonFrom: (_request: Request, status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  preflight: () => null,
  readJson: (request: Request) => request.json(),
}));

jest.mock('@/server/insights', () => ({
  getConsent: (...args: unknown[]) => mockGetConsent(...args),
  getUserTier: (...args: unknown[]) => mockGetUserTier(...args),
  listInsights: (...args: unknown[]) => mockListInsights(...args),
  updateInsightStatus: (...args: unknown[]) => mockUpdateInsightStatus(...args),
}));

const INSIGHT_ID = '11111111-1111-4111-8111-111111111111';
const MOCK_ADMIN = {};

function makeRequest(action: string): Request {
  return new Request(`https://test.local/api/embedded-finance/plan/insights/${INSIGHT_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticate.mockResolvedValue({ ok: true, userId: 'user-1', admin: MOCK_ADMIN });
  mockGetConsent.mockResolvedValue({ enabled: true, consent_version: '2026-11', consented_at: '2026-11-01' });
  mockGetUserTier.mockResolvedValue('free');
  mockListInsights.mockResolvedValue([{ id: INSIGHT_ID }]);
  mockUpdateInsightStatus.mockResolvedValue({ id: INSIGHT_ID, status: 'dismissed' });
});

describe('PATCH /api/embedded-finance/insights/:id', () => {
  it('rejects accepting an insight for a free user', async () => {
    const response = await handleP1Request(makeRequest('accept'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('pro_required');
    expect(mockUpdateInsightStatus).not.toHaveBeenCalled();
  });

  it('allows a free user to dismiss an insight', async () => {
    const response = await handleP1Request(makeRequest('dismiss'));

    expect(response.status).toBe(200);
    expect(mockGetUserTier).not.toHaveBeenCalled();
    expect(mockUpdateInsightStatus).toHaveBeenCalledWith(MOCK_ADMIN, 'user-1', INSIGHT_ID, 'dismissed');
  });

  it('only accepts or dismisses; unknown actions are rejected', async () => {
    const response = await handleP1Request(makeRequest('delete'));
    expect(response.status).toBe(400);
    expect(mockUpdateInsightStatus).not.toHaveBeenCalled();
  });

  it('does not return saved insight data when consent is disabled', async () => {
    mockGetConsent.mockResolvedValue({ enabled: false, consent_version: '2026-11', consented_at: null });
    const response = await handleP1Request(new Request(
      'https://test.local/api/embedded-finance/plan/insights',
      { headers: { Authorization: 'Bearer test' } },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ insights: [] });
    expect(mockListInsights).not.toHaveBeenCalled();
  });
});
