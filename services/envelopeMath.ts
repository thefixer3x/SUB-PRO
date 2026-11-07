/**
 * Envelope maths and matching (P1 / F3).
 *
 * Amounts are in minor units and never summed across currencies.
 */

import type { EnvelopeRow, EnvelopeSpendRow } from './insightEngine';

export interface EnvelopeSummary {
  envelope: EnvelopeRow;
  month: string;
  spent_minor: number;
  remaining_minor: number;
  projected_minor: number;
  days_left: number;
}

export interface MatchableAuthorization {
  merchant_name: string;
  merchant_category: string | null;
  currency: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function tokens(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Pick the envelope a charge belongs to:
 *   1. exact category match (`category_filter` vs `merchant_category`);
 *   2. otherwise the envelope and merchant names share all their exact words.
 * Currency must match in both cases.
 */
export function matchAuthorizationToEnvelope(
  authorization: MatchableAuthorization,
  envelopes: EnvelopeRow[],
): EnvelopeRow | null {
  const currency = (authorization.currency || 'USD').toUpperCase();
  const candidates = envelopes.filter(
    (envelope) => (envelope.currency || 'USD').toUpperCase() === currency,
  );
  if (candidates.length === 0) return null;

  const category = normalize(authorization.merchant_category);
  if (category) {
    const byCategory = candidates.filter(
      (envelope) => normalize(envelope.category_filter) === category,
    );
    if (byCategory.length === 1) return byCategory[0];
  }

  const merchant = normalize(authorization.merchant_name);
  if (!merchant) return null;

  const merchantTokens = tokens(authorization.merchant_name);
  const byName: EnvelopeRow[] = [];
  for (const envelope of candidates) {
    const envelopeName = normalize(envelope.name);
    if (!envelopeName) continue;
    const envelopeTokens = tokens(envelope.name);
    // Compare complete words in both directions. Substring matching can map
    // "Car" to "Carrefour" or "Go" to "Google" and persist spend incorrectly.
    const sharesAllWords = envelopeTokens.length > 0 && merchantTokens.length > 0 && (
      envelopeTokens.every((token) => merchantTokens.includes(token)) ||
      merchantTokens.every((token) => envelopeTokens.includes(token))
    );
    if (sharesAllWords) {
      byName.push(envelope);
    }
  }

  return byName.length === 1 ? byName[0] : null;
}

/** Parse a major-unit input while accepting decimal commas from mobile keyboards. */
export function parseEnvelopeAmount(input: string): number {
  return Number(input.trim().replace(',', '.'));
}

/** Start one month back so the first run of a month recovers its prior boundary. */
export function getEnvelopeSpendScanStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/** Month-to-date spend and a straight-line projection for each envelope. */
export function summarizeEnvelopes(
  envelopes: EnvelopeRow[],
  spend: EnvelopeSpendRow[],
  now: Date = new Date(),
): EnvelopeSummary[] {
  const month = now.toISOString().slice(0, 7);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = Math.max(now.getUTCDate(), 1);
  const fractionElapsed = Math.min(daysElapsed / daysInMonth, 1);
  const daysLeft = Math.max(daysInMonth - now.getUTCDate(), 0);

  const currencyByEnvelope = new Map(
    envelopes.map((envelope) => [envelope.id, (envelope.currency || 'USD').toUpperCase()]),
  );
  const spentByEnvelope = new Map<string, number>();
  for (const row of spend) {
    if (row.month !== month) continue;
    if ((row.currency || 'USD').toUpperCase() !== currencyByEnvelope.get(row.envelope_id)) continue;
    spentByEnvelope.set(
      row.envelope_id,
      (spentByEnvelope.get(row.envelope_id) ?? 0) + row.amount_minor,
    );
  }

  return envelopes.map((envelope) => {
    const spent = spentByEnvelope.get(envelope.id) ?? 0;
    return {
      envelope,
      month,
      spent_minor: spent,
      remaining_minor: envelope.monthly_amount_minor - spent,
      projected_minor: Math.round(spent / fractionElapsed),
      days_left: daysLeft,
    };
  });
}
