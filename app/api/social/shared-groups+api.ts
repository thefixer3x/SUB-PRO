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
        ownerId: 'user-123',
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscriptionId, name, description, totalCost, members, splitMethod } = body;

    // Validate input
    if (!subscriptionId || !name || !totalCost || !members || !splitMethod) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In a real app, create group in database
    const sharedGroup: SharedGroup = {
      id: `group_${Date.now()}`,
      subscriptionId,
      ownerId: 'user-123', // In real app, get from authenticated user
      name,
      description,
      totalCost,
      splitMethod,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock creating members in database
    console.log('Creating shared group with members:', members);

    return Response.json(sharedGroup);
  } catch (error) {
    console.error('Shared group creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create shared group' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}