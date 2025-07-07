export async function POST(request: Request) {
  try {
    const auditEvent = await request.json();

    // Validate audit event
    if (!auditEvent.userId || !auditEvent.action || !auditEvent.resource) {
      return new Response(
        JSON.stringify({ error: 'Missing required audit fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production, save to database with proper indexing
    console.log('Audit event logged:', {
      id: auditEvent.id,
      userId: auditEvent.userId,
      action: auditEvent.action,
      resource: auditEvent.resource,
      timestamp: auditEvent.timestamp,
      category: auditEvent.category,
      severity: auditEvent.severity,
    });

    // Store sensitive metadata separately if needed
    if (auditEvent.metadata) {
      console.log('Audit metadata:', auditEvent.metadata);
    }

    return Response.json({ success: true, id: auditEvent.id });
  } catch (error) {
    console.error('Audit logging error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to log audit event' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}