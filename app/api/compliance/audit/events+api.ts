export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const category = url.searchParams.get('category');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production, query database with filters
    const mockEvents = [
      {
        id: 'audit_1',
        userId,
        action: 'data_export_requested',
        resource: 'user_data',
        resourceId: null,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        metadata: { exportType: 'full' },
        timestamp: new Date(),
        severity: 'warning',
        category: 'data_export',
      },
      {
        id: 'audit_2',
        userId,
        action: 'subscription_created',
        resource: 'subscription',
        resourceId: 'sub_123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        metadata: { subscriptionName: 'Netflix' },
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        severity: 'info',
        category: 'subscription',
      },
    ];

    // Apply filters
    let filteredEvents = mockEvents;

    if (category) {
      filteredEvents = filteredEvents.filter(event => event.category === category);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= end);
    }

    // Apply limit
    filteredEvents = filteredEvents.slice(0, limit);

    return Response.json(filteredEvents);
  } catch (error) {
    console.error('Audit events API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get audit events' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}