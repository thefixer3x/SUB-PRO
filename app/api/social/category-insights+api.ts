export async function GET(request: Request) {
  try {
    // In a real app, fetch from database
    // For now, return mock data
    const mockCategoryInsights = [
      {
        category: 'Entertainment',
        averageCost: 39.47,
        userCount: 189,
        totalSpending: 7460.00,
      },
      {
        category: 'Productivity',
        averageCost: 27.86,
        userCount: 143,
        totalSpending: 3984.00,
      },
      {
        category: 'Creative',
        averageCost: 58.62,
        userCount: 95,
        totalSpending: 5569.00,
      },
      {
        category: 'AI',
        averageCost: 24.99,
        userCount: 76,
        totalSpending: 1899.24,
      },
      {
        category: 'Development',
        averageCost: 15.48,
        userCount: 63,
        totalSpending: 975.24,
      }
    ];

    return Response.json(mockCategoryInsights);
  } catch (error) {
    console.error('Category insights GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get category insights' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}