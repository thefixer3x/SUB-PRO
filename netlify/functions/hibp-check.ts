import { HandlerEvent, HandlerContext } from '@netlify/functions';
import { requireUser } from '../_shared/auth';
import { handlePreflight } from '../_shared/cors';

/**
 * Server-side proxy for Have I Been Pwned (HIBP) API calls.
 * Holds HAVEIBEENPWNED_API_KEY server-side — never exposed to client.
 */

const HIBP_API_KEY = process.env.HAVEIBEENPWNED_API_KEY;

if (!HIBP_API_KEY) {
  throw new Error('HAVEIBEENPWNED_API_KEY environment variable is required');
}

interface HIBPRequest {
  email: string;
}

export async function handler(event: HandlerEvent, _context: HandlerContext) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight();
  }

  // Require auth
  const userId = await requireUser(event);
  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Get email from query params or body
    const email = event.queryStringParameters?.email
      || (event.body ? JSON.parse(event.body)?.email : null);

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
    }

    // HIBP API: check if email appears in breaches
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
      {
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'user-agent': 'SubTrackPro/1.0',
        },
      }
    );

    if (response.status === 404) {
      // Not found = not breached
      return { statusCode: 200, body: JSON.stringify({ breached: false }) };
    }

    if (!response.ok) {
      return { statusCode: response.status, body: await response.text() };
    }

    const breaches = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        breached: true,
        breaches: breaches.map((b: any) => ({
          name: b.Name,
          description: b.Description,
          breachDate: b.BreachDate,
          addedDate: b.AddedDate,
          dataClasses: b.DataClasses,
        })),
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
