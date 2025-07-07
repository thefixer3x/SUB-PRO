import { CommunityStats } from '@/types/social';

export async function GET(request: Request) {
  try {
    // In a real app, fetch aggregated stats from database
    // For now, return mock data
    const mockStats: CommunityStats[] = [
      {
        id: 'stats_1',
        serviceName: 'Netflix',
        category: 'Entertainment',
        userCount: 156,
        averageCost: 15.99,
        medianCost: 14.99,
        costRange: { min: 8.99, max: 19.99 },
        popularPlans: [
          { planName: 'Standard', userCount: 78, averageCost: 14.99 },
          { planName: 'Premium', userCount: 54, averageCost: 19.99 },
          { planName: 'Basic', userCount: 24, averageCost: 8.99 },
        ],
        updatedAt: new Date(),
      },
      {
        id: 'stats_2',
        serviceName: 'Spotify',
        category: 'Entertainment',
        userCount: 134,
        averageCost: 10.99,
        medianCost: 9.99,
        costRange: { min: 4.99, max: 15.99 },
        popularPlans: [
          { planName: 'Individual', userCount: 89, averageCost: 9.99 },
          { planName: 'Family', userCount: 31, averageCost: 15.99 },
          { planName: 'Student', userCount: 14, averageCost: 4.99 },
        ],
        updatedAt: new Date(),
      },
      {
        id: 'stats_3',
        serviceName: 'Adobe Creative Cloud',
        category: 'Creative',
        userCount: 87,
        averageCost: 52.99,
        medianCost: 54.99,
        costRange: { min: 19.99, max: 79.99 },
        popularPlans: [
          { planName: 'All Apps', userCount: 42, averageCost: 54.99 },
          { planName: 'Photography', userCount: 32, averageCost: 19.99 },
          { planName: 'Single App', userCount: 13, averageCost: 20.99 },
        ],
        updatedAt: new Date(),
      }
    ];

    return Response.json(mockStats);
  } catch (error) {
    console.error('Community stats GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get community stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}