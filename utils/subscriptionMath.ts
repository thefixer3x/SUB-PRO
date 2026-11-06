import type { Subscription } from '@/types/subscription';

/** Normalise any billing cycle to a monthly-equivalent cost. */
export function normalizeToMonthly(monthlyCost: number, billingCycle: string): number {
  switch (billingCycle) {
    case 'Monthly':
      return monthlyCost;
    case 'Weekly':
      return monthlyCost * 52 / 12;
    case 'Quarterly':
      return monthlyCost / 3;
    case 'Annually':
      return monthlyCost / 12;
    default:
      return monthlyCost;
  }
}

/** Sum of all subscriptions normalised to monthly. */
export function calculateMonthlyTotal(subscriptions: Subscription[]): number {
  return subscriptions.reduce(
    (sum, sub) => sum + normalizeToMonthly(sub.monthlyCost, sub.billingCycle),
    0,
  );
}

/** Annual projection from a monthly total. */
export function calculateAnnualTotal(monthlyTotal: number): number {
  return monthlyTotal * 12;
}

/**
 * Subscriptions whose `renewalDate` falls within `days` from `now`.
 * Defaults to 7 days.
 */
export function calculateUpcomingRenewals(
  subscriptions: Subscription[],
  days = 7,
  now: Date = new Date(),
): Subscription[] {
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return subscriptions.filter((sub) => {
    const rd = new Date(sub.renewalDate);
    return rd >= now && rd <= cutoff;
  });
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

/** Per-category spending breakdown with percentages. */
export function calculateCategoryBreakdown(
  subscriptions: Subscription[],
): CategoryBreakdown[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const sub of subscriptions) {
    const monthly = normalizeToMonthly(sub.monthlyCost, sub.billingCycle);
    map.set(sub.category, (map.get(sub.category) ?? 0) + monthly);
    total += monthly;
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Returns true when subscriptions span more than one currency. */
export function detectMixedCurrencies(subscriptions: Subscription[]): boolean {
  const currencies = new Set(subscriptions.map((s) => s.currency));
  return currencies.size > 1;
}

export interface DashboardStats {
  monthlyTotal: number;
  annualTotal: number;
  activeCount: number;
  upcomingRenewals: Subscription[];
  categoryBreakdown: CategoryBreakdown[];
  mixedCurrencies: boolean;
}

/** One-stop dashboard aggregation. */
export function getDashboardStats(
  subscriptions: Subscription[],
  renewalDays = 7,
  now: Date = new Date(),
): DashboardStats {
  const monthlyTotal = calculateMonthlyTotal(subscriptions);
  return {
    monthlyTotal,
    annualTotal: calculateAnnualTotal(monthlyTotal),
    activeCount: subscriptions.filter((s) => s.status === 'Active').length,
    upcomingRenewals: calculateUpcomingRenewals(subscriptions, renewalDays, now),
    categoryBreakdown: calculateCategoryBreakdown(subscriptions),
    mixedCurrencies: detectMixedCurrencies(subscriptions),
  };
}

// ─── Potential Savings ───────────────────────────────────────────────────────

export interface SavingsReason {
  type: 'duplicate_category' | 'annual_optimization';
  category: string;
  description: string;
  monthlyAmount: number;
}

export interface PotentialSavings {
  monthlyAmount: number;
  reasons: SavingsReason[];
}

/**
 * Compute potential monthly savings from real subscription data.
 *
 * Both rules are computed ONLY from amounts the user actually holds. Nothing
 * here estimates a discount the user has not been quoted.
 *
 * 1. Duplicate category — two or more active subscriptions in the same
 *    category can often be consolidated into one plan. Keeping only the
 *    cheapest plan in the group and dropping the rest saves the sum of every
 *    dropped plan's monthly-equivalent cost.
 * 2. Annual optimization — the user holds the SAME service on more than one
 *    billing cycle (e.g. a monthly plan and an annual plan for the same
 *    product). Switching to the cheaper cycle saves the difference between
 *    the two real per-month prices. A monthly plan with no annual counterpart
 *    produces no saving, because no annual price exists to compare against.
 */
export function calculatePotentialSavings(
  subscriptions: Subscription[],
): PotentialSavings {
  const reasons: SavingsReason[] = [];
  let totalMonthly = 0;

  const active = subscriptions.filter((s) => s.status === 'Active');

  // Rule 2 first — the same service held on more than one billing cycle.
  // Only compares cycles the user actually holds; no assumed discount.
  const byService = new Map<string, Subscription[]>();
  for (const sub of active) {
    const key = `${sub.name.toLowerCase()}|${sub.category}`;
    const list = byService.get(key) ?? [];
    list.push(sub);
    byService.set(key, list);
  }

  // A service that Rule 2 already charged for is excluded from Rule 1,
  // otherwise the same money would be counted twice (dropping a monthly plan
  // and switching to the annual one are the same saving). A service whose
  // cycles cost the same per month produces no Rule 2 saving, so both of its
  // legs stay in Rule 1 — dropping one of them is a genuine duplicate.
  const cycleSwitched = new Set<string>();

  for (const [key, subs] of byService) {
    if (subs.length < 2) continue;

    const monthlyCosts = subs.map((s) => normalizeToMonthly(s.monthlyCost, s.billingCycle));
    const cheapest = Math.min(...monthlyCosts);
    const dearest = Math.max(...monthlyCosts);
    const saving = dearest - cheapest;

    if (saving > 0) {
      const rounded = Math.round(saving * 100) / 100;
      totalMonthly += rounded;
      cycleSwitched.add(key);
      const cheaper = subs[monthlyCosts.indexOf(cheapest)];
      reasons.push({
        type: 'annual_optimization',
        category: cheaper.category,
        description: `Switch ${cheaper.name} to its cheaper billing cycle`,
        monthlyAmount: rounded,
      });
    }
  }

  // Rule 1 — duplicate categories: consolidate into the cheapest plan.
  const byCategory = new Map<string, Subscription[]>();
  for (const sub of active) {
    const key = `${sub.name.toLowerCase()}|${sub.category}`;
    if (cycleSwitched.has(key)) continue;
    const list = byCategory.get(sub.category) ?? [];
    list.push(sub);
    byCategory.set(sub.category, list);
  }

  for (const [category, subs] of byCategory) {
    if (subs.length < 2) continue;

    const costs = subs.map((s) => normalizeToMonthly(s.monthlyCost, s.billingCycle));
    const sortedCosts = [...costs].sort((a, b) => a - b);
    // Keep the cheapest plan; everything else is what consolidation saves.
    const saving = sortedCosts.slice(1).reduce((sum, c) => sum + c, 0);

    if (saving > 0) {
      const rounded = Math.round(saving * 100) / 100;
      totalMonthly += rounded;
      reasons.push({
        type: 'duplicate_category',
        category,
        description: `Consolidate ${category} services into one plan`,
        monthlyAmount: rounded,
      });
    }
  }

  return {
    monthlyAmount: Math.round(totalMonthly * 100) / 100,
    reasons,
  };
}

// ─── Currency split ──────────────────────────────────────────────────────────

export interface CurrencySplit {
  /** The currency every total is computed in. */
  currency: string;
  /** Subscriptions billed in `currency`; only these are summed. */
  included: Subscription[];
  /** Subscriptions in any other currency; never added to `currency` totals. */
  excluded: Subscription[];
  /** The other currencies present, upper-case, in first-seen order. */
  otherCurrencies: string[];
}

/**
 * Amounts in different currencies cannot be added without an exchange rate,
 * and the app has none. So totals use the currency most of the user's
 * subscriptions are billed in (ties go to the first seen), and the rest are
 * reported separately instead of being summed into it.
 */
export function splitByPrimaryCurrency(
  subscriptions: Subscription[],
  fallback = 'USD',
): CurrencySplit {
  const codeOf = (s: Subscription) => (s.currency || fallback).toUpperCase();

  const counts = new Map<string, number>();
  for (const sub of subscriptions) {
    const code = codeOf(sub);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  let currency = fallback.toUpperCase();
  let best = 0;
  for (const [code, count] of counts) {
    if (count > best) {
      currency = code;
      best = count;
    }
  }

  const included = subscriptions.filter((s) => codeOf(s) === currency);
  const excluded = subscriptions.filter((s) => codeOf(s) !== currency);
  const otherCurrencies = [...counts.keys()].filter((c) => c !== currency);

  return { currency, included, excluded, otherCurrencies };
}
