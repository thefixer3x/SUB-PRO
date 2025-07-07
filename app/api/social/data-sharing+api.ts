import { UserDataSharing } from '@/types/social';

// GET endpoint to retrieve user's data sharing preferences
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // In a real app, fetch from database
    // For now, return mock data
    const mockDataSharing: UserDataSharing = {
      userId,
      enabled: false, // Default to false
      dataTypes: {
        subscriptionCosts: false,
        categories: false,
        planTypes: false,
      },
      consentDate: new Date(),
    };

    return Response.json(mockDataSharing);
  } catch (error) {
    console.error('Data sharing GET error:', error);
    return Response.json({ error: 'Failed to get data sharing preferences' }, { status: 500 });
  }
}

// POST endpoint to update user's data sharing preferences
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, enabled, dataTypes, consentDate } = body;

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Validate data types
    if (enabled && (!dataTypes || typeof dataTypes !== 'object')) {
      return Response.json({ error: 'Invalid data types provided' }, { status: 400 });
    }

    // In a real app, save to database
    console.log('Updated data sharing preferences for user:', userId, {
      enabled,
      dataTypes,
      consentDate: consentDate || new Date(),
    });

    // If user opted out, record the opt-out date
    if (!enabled) {
      console.log('User opted out of data sharing:', userId, 'at', new Date());
    }

    // Return success response
    return Response.json({ success: true });
  } catch (error) {
    console.error('Data sharing POST error:', error);
    return Response.json({ error: 'Failed to update data sharing preferences' }, { status: 500 });
  }
}