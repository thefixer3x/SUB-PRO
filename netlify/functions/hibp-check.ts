import { requireUser, type NetlifyEvent, type NetlifyResult } from './_shared/auth';
import { getRequestOrigin, handlePreflight, isOriginAllowed, jsonResponse } from './_shared/cors';

/**
 * Server-side proxy for Have I Been Pwned (HIBP) breach lookups.
 * Holds HAVEIBEENPWNED_API_KEY server-side; never exposed to the client.
 * Checks only the signed-in user's own email address.
 * Card S203 (docs/agents/EXECUTION_PLAN.md) moves this to api/hibp-check.ts.
 */
export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(event);
  }

  const origin = getRequestOrigin(event);
  if (!isOriginAllowed(origin)) {
    return jsonResponse(403, { error: 'Origin not allowed' });
  }

  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  const auth = await requireUser(event);
  if (!auth.ok) {
    return auth.response;
  }

  const apiKey = process.env.HAVEIBEENPWNED_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { error: 'Breach check is not configured' }, origin);
  }

  const email = auth.user.email;
  if (!email) {
    return jsonResponse(400, { error: 'Account has no email address' }, origin);
  }

  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      { headers: { 'hibp-api-key': apiKey, 'user-agent': 'SubTrackPro/1.0' } },
    );

    if (response.status === 404) {
      return jsonResponse(200, { breached: false }, origin);
    }
    if (!response.ok) {
      return jsonResponse(502, { error: 'Breach service unavailable' }, origin);
    }

    const breaches = (await response.json()) as Record<string, unknown>[];
    return jsonResponse(
      200,
      {
        breached: true,
        breaches: breaches.map((b) => ({
          name: b.Name,
          breachDate: b.BreachDate,
          addedDate: b.AddedDate,
          dataClasses: b.DataClasses,
        })),
      },
      origin,
    );
  } catch {
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
};
