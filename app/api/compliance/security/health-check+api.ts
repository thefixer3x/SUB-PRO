export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production, fetch from database
    // For now, return mock data
    const mockHealthCheck = {
      id: 'health_123',
      userId,
      score: 75,
      lastRunAt: new Date(),
      findings: [
        {
          id: 'finding_1',
          type: 'weak_auth',
          severity: 'medium',
          title: 'Two-Factor Authentication Disabled',
          description: 'Your account is not protected by two-factor authentication',
          recommendation: 'Enable 2FA to significantly improve your account security',
          createdAt: new Date(),
        },
      ],
      status: 'warning',
      nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return Response.json(mockHealthCheck);
  } catch (error) {
    console.error('Health check API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const healthCheck = await request.json();

    // In production, save to database
    console.log('Storing health check:', healthCheck.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Health check storage error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to store health check' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}