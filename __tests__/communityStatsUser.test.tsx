/**
 * Community screen and the mock shared-groups route never fall back to a
 * fixed placeholder user id.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

let mockUser: { id: string } | null = { id: '11111111-1111-4111-8111-111111111111' };
const mockGetUserDataSharing = jest.fn(async (_id: string) => ({ enabled: false }));
const mockInsightsUserIds: string[] = [];

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ currentTier: 'pro' }) }));
jest.mock('@/services/communityStats', () => ({
  communityStatsService: { getUserDataSharing: (id: string) => mockGetUserDataSharing(id) },
}));
jest.mock('@/components/social/CommunityInsights', () => ({
  CommunityInsights: ({ userId }: { userId: string }) => {
    mockInsightsUserIds.push(userId);
    return null;
  },
}));
jest.mock('@/components/monetization/AdBanner', () => ({ AdBanner: () => null }));
jest.mock('@/components/monetization/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => children,
}));

// eslint-disable-next-line import/first
import CommunityStats from '@/app/(tabs)/community-stats';
// eslint-disable-next-line import/first
import { GET, POST } from '@/app/api/social/shared-groups+api';

beforeEach(() => {
  mockGetUserDataSharing.mockClear();
  mockInsightsUserIds.length = 0;
});

describe('Community screen', () => {
  it('reads data-sharing preferences for the signed-in user', () => {
    mockUser = { id: '11111111-1111-4111-8111-111111111111' };
    render(<CommunityStats />);
    expect(mockGetUserDataSharing).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(mockInsightsUserIds).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('reads nothing when nobody is signed in', () => {
    mockUser = null;
    render(<CommunityStats />);
    expect(mockGetUserDataSharing).not.toHaveBeenCalled();
    expect(mockInsightsUserIds).toHaveLength(0);
  });
});

describe('shared-groups mock route', () => {
  it('does not pretend a group was created', async () => {
    const res = await POST(new Request('http://localhost/api/social/shared-groups', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(501);
  });

  it('never returns the placeholder owner', async () => {
    const res = await GET(new Request('http://localhost/api/social/shared-groups?userId=abc'));
    const groups = await res.json();
    expect(groups.map((g: { ownerId: string }) => g.ownerId)).not.toContain('user-123');
    expect(groups[0].ownerId).toBe('abc');
  });
});
