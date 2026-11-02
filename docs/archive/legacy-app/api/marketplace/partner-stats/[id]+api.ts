export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const partnerId = params.id;
    
    if (!partnerId) {
      return new Response(
        JSON.stringify({ error: 'Partner ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In a real app, this would query a database
    // For demo purposes, we'll return mock data
    const mockStats = {
      totalClicks: Math.floor(Math.random() * 100) + 20,
      uniqueClicks: Math.floor(Math.random() * 50) + 10,
      conversionRate: Math.random() * 0.15, // 0-15% conversion rate
      lastClickDate: new Date(),
    };

    return Response.json(mockStats);
  } catch (error) {
    console.error('Partner stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve partner stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}