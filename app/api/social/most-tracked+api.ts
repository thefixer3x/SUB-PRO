export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // In a real app, fetch from database
    // For now, return mock data
    const mockMostTracked = [
      {
        serviceName: 'Netflix',
        userCount: 156,
        averageCost: 15.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'Spotify',
        userCount: 134,
        averageCost: 10.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'Adobe Creative Cloud',
        userCount: 87,
        averageCost: 52.99,
        category: 'Creative',
      },
      {
        serviceName: 'Disney+',
        userCount: 78,
        averageCost: 7.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'Microsoft 365',
        userCount: 72,
        averageCost: 9.99,
        category: 'Productivity',
      },
      {
        serviceName: 'Amazon Prime',
        userCount: 67,
        averageCost: 14.99,
        category: 'Shopping',
      },
      {
        serviceName: 'YouTube Premium',
        userCount: 63,
        averageCost: 11.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'Apple Music',
        userCount: 52,
        averageCost: 9.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'GitHub Pro',
        userCount: 48,
        averageCost: 4.00,
        category: 'Development',
      },
      {
        serviceName: 'HBO Max',
        userCount: 44,
        averageCost: 14.99,
        category: 'Entertainment',
      },
      {
        serviceName: 'Notion',
        userCount: 42,
        averageCost: 8.00,
        category: 'Productivity',
      },
      {
        serviceName: 'Hulu',
        userCount: 38,
        averageCost: 7.99,
        category: 'Entertainment',
      }
    ].slice(0, limit);

    return Response.json(mockMostTracked);
  } catch (error) {
    console.error('Most tracked GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get most tracked services' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}