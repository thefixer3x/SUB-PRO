/**
 * Deterministic insight engine (P1).
 *
 * Pure functions over the rows the app already has: no LLM, no network, no
 * card data. Every insight carries a plain-text explanation and the ids of the
 * rows it came from, so a user can check the claim.
 *
 * Data sources:
 *   - `card_authorizations` (via the owner's cards) for price increases and
 *     new recurring merchants. Empty until P2 issues cards, so these detectors
 *     are unit-tested with fixtures and light up when data arrives.
 *   - `sm_subscriptions` for unused-before-renewal and duplicate insights.
 *   - `sm_envelopes` + `sm_envelope_spend` for envelope-at-risk.
 */

export type InsightType =
  | 'price_increase'
  | 'new_recurring_merchant'
  | 'unused_before_renewal'
  | 'duplicate_subscription'
  | 'envelope_at_risk';

export interface InsightEvent {
  type: InsightType;
  payload: Record<string, unknown>;
  sourceEventIds: string[];
  explanation: string;
  /** Stable per user; the unique index turns a repeated scan into a no-op. */
  dedupeKey: string;
}

export interface CardAuthorizationRow {
  id: string;
  merchant_name: string;
  merchant_category: string | null;
  /** Minor units (cents). */
  amount: number;
  currency: string;
  transaction_date: string;
  approved?: boolean | null;
}

export interface SubscriptionRow {
  id: string;
  name: string;
  category: string;
  monthly_cost: number;
  currency: string;
  renewal_date: string;
  last_used: string | null;
  status: string;
}

export interface EnvelopeRow {
  id: string;
  name: string;
  currency: string;
  monthly_amount_minor: number;
  category_filter: string | null;
}

export interface EnvelopeSpendRow {
  id?: string;
  envelope_id: string;
  amount_minor: number;
  currency: string;
  month: string;
}

export interface InsightData {
  authorizations: CardAuthorizationRow[];
  subscriptions: SubscriptionRow[];
  envelopes: EnvelopeRow[];
  envelopeSpend: EnvelopeSpendRow[];
}

const MONTHLY_DAYS = 30;
const MONTHLY_TOLERANCE_DAYS = 5;
const YEARLY_DAYS = 365;
const YEARLY_TOLERANCE_DAYS = 10;

const INACTIVE_STATUSES = new Set(['inactive', 'paused', 'canceled', 'cancelled', 'expired']);
const PLAN_NOISE = new Set([
  'plus', 'premium', 'pro', 'family', 'standard', 'basic', 'plan', 'subscription',
  'monthly', 'annual', 'yearly', 'ultimate', 'unlimited', 'member', 'membership',
]);

/** Resolve the ISO currency's minor-unit scale (e.g. JPY=1, USD=100, KWD=1000). */
export function minorUnitFactor(currency: string): number {
  try {
    const fractionDigits = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).resolvedOptions().maximumFractionDigits;
    return 10 ** (fractionDigits ?? 2);
  } catch {
    return 100;
  }
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * minorUnitFactor(currency));
}

export function fromMinorUnits(amountMinor: number, currency: string): number {
  return amountMinor / minorUnitFactor(currency);
}

/** Format minor units for an explanation, never mixing currencies. */
export function formatMinor(amountMinor: number, currency: string): string {
  const amount = fromMinorUnits(amountMinor, currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

export function monthOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 7);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

function merchantKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b(?:com|net|org|co|io)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !PLAN_NOISE.has(token))
    .join(' ')
    .trim();
}

function tokenSet(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter(Boolean));
}

/** Jaccard similarity of the meaningful name tokens. */
function nameSimilarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function approvedOnly(rows: CardAuthorizationRow[]): CardAuthorizationRow[] {
  return rows.filter((row) => row.approved !== false);
}

function byMerchant(rows: CardAuthorizationRow[]): Map<string, CardAuthorizationRow[]> {
  const groups = new Map<string, CardAuthorizationRow[]>();
  for (const row of approvedOnly(rows)) {
    const key = `${merchantKey(row.merchant_name)}|${row.currency || 'USD'}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
    );
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Price increase
// ---------------------------------------------------------------------------

export function detectPriceIncreases(
  authorizations: CardAuthorizationRow[],
  options: { thresholdPct?: number } = {},
): InsightEvent[] {
  const thresholdPct = options.thresholdPct ?? 10;
  const events: InsightEvent[] = [];

  for (const group of byMerchant(authorizations).values()) {
    let latest: { previous: CardAuthorizationRow; current: CardAuthorizationRow; pct: number } | null = null;

    for (let i = 1; i < group.length; i += 1) {
      const previous = group[i - 1];
      const current = group[i];
      if (previous.amount <= 0 || current.amount <= 0) continue;
      const pct = ((current.amount - previous.amount) / previous.amount) * 100;
      if (pct >= thresholdPct) {
        latest = { previous, current, pct };
      }
    }

    if (!latest) continue;

    const { previous, current } = latest;
    const currency = current.currency || 'USD';
    const rounded = Math.round(latest.pct);
    events.push({
      type: 'price_increase',
      payload: {
        merchant_name: current.merchant_name,
        currency,
        previous_amount_minor: previous.amount,
        current_amount_minor: current.amount,
        increase_pct: rounded,
        previous_date: previous.transaction_date,
        current_date: current.transaction_date,
      },
      sourceEventIds: [previous.id, current.id],
      explanation:
        `${current.merchant_name} went from ${formatMinor(previous.amount, currency)} ` +
        `to ${formatMinor(current.amount, currency)} — a ${rounded}% increase.`,
      dedupeKey: `price_increase:${merchantKey(current.merchant_name)}:${currency}:${monthOf(
        current.transaction_date,
      )}`,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// New recurring merchant
// ---------------------------------------------------------------------------

export function detectNewRecurringMerchants(
  authorizations: CardAuthorizationRow[],
  options: { knownSubscriptionNames?: string[] } = {},
): InsightEvent[] {
  const known = new Set((options.knownSubscriptionNames ?? []).map(merchantKey));
  const knownNames = [...known];
  const events: InsightEvent[] = [];

  for (const group of byMerchant(authorizations).values()) {
    const latest = group[group.length - 1];
    if (!latest) continue;

    const key = merchantKey(latest.merchant_name);
    const alreadyTracked = known.has(key) || knownNames.some((name) =>
      (name.length >= 4 && key.includes(name)) || (key.length >= 4 && name.includes(key)),
    );
    if (alreadyTracked) continue; // already a tracked subscription, not new

    let match: { first: CardAuthorizationRow; second: CardAuthorizationRow; days: number; cadence: string } | null = null;

    for (let i = 1; i < group.length; i += 1) {
      const first = group[i - 1];
      const second = group[i];
      const days = daysBetween(first.transaction_date, second.transaction_date);
      if (Number.isNaN(days) || days <= 0) continue;

      if (Math.abs(days - MONTHLY_DAYS) <= MONTHLY_TOLERANCE_DAYS) {
        match = { first, second, days, cadence: 'monthly' };
      } else if (Math.abs(days - YEARLY_DAYS) <= YEARLY_TOLERANCE_DAYS) {
        match = { first, second, days, cadence: 'yearly' };
      }
    }

    if (!match) continue;

    const currency = latest.currency || 'USD';
    events.push({
      type: 'new_recurring_merchant',
      payload: {
        merchant_name: latest.merchant_name,
        merchant_category: latest.merchant_category,
        currency,
        amount_minor: latest.amount,
        cadence: match.cadence,
        interval_days: match.days,
        first_seen: match.first.transaction_date,
        last_seen: match.second.transaction_date,
      },
      sourceEventIds: [match.first.id, match.second.id],
      explanation:
        `You've been charged by ${latest.merchant_name} twice in ${match.days} days — ` +
        `this looks like a ${match.cadence} subscription.`,
      dedupeKey: `new_recurring_merchant:${key}:${currency}`,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Unused before renewal
// ---------------------------------------------------------------------------

export function detectUnusedBeforeRenewal(
  subscriptions: SubscriptionRow[],
  options: { daysBeforeRenewal?: number; staleUsageDays?: number; now?: Date } = {},
): InsightEvent[] {
  const daysBeforeRenewal = options.daysBeforeRenewal ?? 7;
  const staleUsageDays = options.staleUsageDays ?? 30;
  const now = options.now ?? new Date();
  const events: InsightEvent[] = [];

  for (const sub of subscriptions) {
    if (INACTIVE_STATUSES.has(sub.status.toLowerCase())) continue;

    const renewal = new Date(sub.renewal_date);
    if (Number.isNaN(renewal.getTime())) continue;

    const daysUntilRenewal = Math.ceil((renewal.getTime() - now.getTime()) / 86_400_000);
    if (daysUntilRenewal < 0 || daysUntilRenewal > daysBeforeRenewal) continue;

    const lastUsed = sub.last_used ? new Date(sub.last_used) : null;
    const daysSinceUsed = lastUsed
      ? Math.floor((now.getTime() - lastUsed.getTime()) / 86_400_000)
      : null;

    const unused = daysSinceUsed === null || daysSinceUsed >= staleUsageDays;
    if (!unused) continue;

    const renews = `renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}`;
    const explanation = daysSinceUsed === null
      ? `${sub.name} ${renews} and has no recorded usage.`
      : `${sub.name} ${renews} and you haven't used it in ${daysSinceUsed} days.`;

    events.push({
      type: 'unused_before_renewal',
      payload: {
        subscription_id: sub.id,
        name: sub.name,
        category: sub.category,
        monthly_cost: sub.monthly_cost,
        currency: sub.currency,
        renewal_date: sub.renewal_date,
        days_until_renewal: daysUntilRenewal,
        last_used: sub.last_used,
        days_since_used: daysSinceUsed,
      },
      sourceEventIds: [sub.id],
      explanation,
      dedupeKey: `unused_before_renewal:${sub.id}:${monthOf(sub.renewal_date)}`,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Duplicate subscription
// ---------------------------------------------------------------------------

export function detectDuplicateSubscriptions(subscriptions: SubscriptionRow[]): InsightEvent[] {
  const active = subscriptions.filter((sub) => !INACTIVE_STATUSES.has(sub.status.toLowerCase()));
  const events: InsightEvent[] = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (a.category !== b.category) continue;
      if ((a.currency || 'USD') !== (b.currency || 'USD')) continue;

      const similarity = nameSimilarity(a.name, b.name);
      const nameA = normalizeName(a.name);
      const nameB = normalizeName(b.name);
      const oneContainsOther =
        nameA.length > 0 &&
        nameB.length > 0 &&
        (nameA.includes(nameB) || nameB.includes(nameA));
      if (similarity < 0.5 && !oneContainsOther) continue;

      const [first, second] = [a.id, b.id].sort();
      const currency = a.currency || 'USD';
      events.push({
        type: 'duplicate_subscription',
        payload: {
          category: a.category,
          currency,
          subscriptions: [
            { id: a.id, name: a.name, monthly_cost: a.monthly_cost },
            { id: b.id, name: b.name, monthly_cost: b.monthly_cost },
          ],
          combined_monthly_cost: a.monthly_cost + b.monthly_cost,
        },
        sourceEventIds: [a.id, b.id],
        explanation:
          `${a.name} and ${b.name} are both in ${a.category} — you may be paying twice ` +
          `(${formatMinor(toMinorUnits(a.monthly_cost + b.monthly_cost, currency), currency)}/mo).`,
        dedupeKey: `duplicate_subscription:${first}:${second}`,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Envelope at risk
// ---------------------------------------------------------------------------

export function detectEnvelopesAtRisk(
  envelopes: EnvelopeRow[],
  spend: EnvelopeSpendRow[],
  options: { now?: Date } = {},
): InsightEvent[] {
  const now = options.now ?? new Date();
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
    spentByEnvelope.set(row.envelope_id, (spentByEnvelope.get(row.envelope_id) ?? 0) + row.amount_minor);
  }

  const events: InsightEvent[] = [];

  for (const envelope of envelopes) {
    if (envelope.monthly_amount_minor <= 0) continue;
    const spent = spentByEnvelope.get(envelope.id) ?? 0;
    if (spent <= 0) continue;

    const projected = Math.round(spent / fractionElapsed);
    if (projected <= envelope.monthly_amount_minor) continue;
    // A single subscription charge early in the month creates a misleading
    // straight-line projection. Require either more elapsed time or material
    // usage of the budget before notifying.
    if (fractionElapsed < 0.25 && spent < envelope.monthly_amount_minor * 0.75) continue;

    const currency = envelope.currency || 'USD';
    events.push({
      type: 'envelope_at_risk',
      payload: {
        envelope_id: envelope.id,
        name: envelope.name,
        currency,
        monthly_amount_minor: envelope.monthly_amount_minor,
        spent_minor: spent,
        projected_minor: projected,
        month,
        days_left: daysLeft,
      },
      sourceEventIds: [],
      explanation:
        `${envelope.name}: spent ${formatMinor(spent, currency)} of ` +
        `${formatMinor(envelope.monthly_amount_minor, currency)} with ${daysLeft} ` +
        `day${daysLeft === 1 ? '' : 's'} left — on pace for ${formatMinor(projected, currency)}.`,
      dedupeKey: `envelope_at_risk:${envelope.id}:${month}`,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface DetectOptions {
  now?: Date;
  priceIncreaseThresholdPct?: number;
  daysBeforeRenewal?: number;
  staleUsageDays?: number;
}

export function detectAll(data: InsightData, options: DetectOptions = {}): InsightEvent[] {
  return [
    ...detectPriceIncreases(data.authorizations, {
      thresholdPct: options.priceIncreaseThresholdPct,
    }),
    ...detectNewRecurringMerchants(data.authorizations, {
      knownSubscriptionNames: data.subscriptions.map((sub) => sub.name),
    }),
    ...detectUnusedBeforeRenewal(data.subscriptions, {
      daysBeforeRenewal: options.daysBeforeRenewal,
      staleUsageDays: options.staleUsageDays,
      now: options.now,
    }),
    ...detectDuplicateSubscriptions(data.subscriptions),
    ...detectEnvelopesAtRisk(data.envelopes, data.envelopeSpend, { now: options.now }),
  ];
}
