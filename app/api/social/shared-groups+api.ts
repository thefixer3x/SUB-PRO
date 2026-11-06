import { SharedGroup } from '@/types/social';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In a real app, fetch from database
    // For now, return mock data
    const mockSharedGroups: SharedGroup[] = [
      {
        id: 'group_1',
        subscriptionId: '3', // Netflix
        ownerId: userId,
        name: 'Family Netflix',
        description: 'Shared Netflix account for the family',
        totalCost: 19.99,
        splitMethod: 'equal',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: new Date(),
      },
      {
        id: 'group_2',
        subscriptionId: '2', // Notion
        ownerId: 'user-456',
        name: 'Team Workspace',
        description: 'Shared Notion workspace for the team',
        totalCost: 8.00,
        splitMethod: 'percentage',
        splitwiseGroupId: '12345',
        status: 'active',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        updatedAt: new Date(),
      }
    ];

    return Response.json(mockSharedGroups);
  } catch (error) {
    console.error('Shared groups GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get shared groups' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Shared groups are not stored anywhere yet, so creating one must not report
 * success: it used to return a group owned by a fixed placeholder user, and
 * the app then told people their invitations had been sent.
 */
export async function POST(_request: Request) {
  return new Response(
    JSON.stringify({ error: 'Creating shared groups is not available yet' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}
