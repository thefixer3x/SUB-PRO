/**
 * Have I Been Pwned (HIBP) breach-check business logic.
 *
 * Ported from netlify/functions/hibp-check.ts — checks only the signed-in
 * user's own email address.  The API key is held server-side.
 */

export interface BreachInfo {
  name: string;
  breachDate: string;
  addedDate: string;
  dataClasses: unknown[];
}

export interface BreachCheckResult {
  breached: boolean;
  breaches?: BreachInfo[];
}

/**
 * Check if an email has been breached.
 *
 * Returns `breached: false` when HIBP returns 404 (not found).
 */
export const checkBreach = async (
  email: string,
  apiKey: string,
): Promise<{ ok: true; data: BreachCheckResult } | { ok: false; error: string }> => {
  try {
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': apiKey,
          'user-agent': 'SubTrackPro/1.0',
        },
      },
    );

    if (response.status === 404) {
      return { ok: true, data: { breached: false } };
    }
    if (!response.ok) {
      return { ok: false, error: 'Breach service unavailable' };
    }

    const breaches = (await response.json()) as Array<Record<string, unknown>>;
    return {
      ok: true,
      data: {
        breached: true,
        breaches: breaches.map((b) => ({
          name: b.Name as string,
          breachDate: b.BreachDate as string,
          addedDate: b.AddedDate as string,
          dataClasses: b.DataClasses as unknown[],
        })),
      },
    };
  } catch {
    return { ok: false, error: 'Internal server error' };
  }
};
