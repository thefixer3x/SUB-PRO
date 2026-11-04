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
 * Two computable rules:
 * 1. Duplicate category — two or more active subscriptions in the same
 *    category can often be consolidated (family plans, overlapping services).
 *    Savings = sum of (second_highest_cost − lowest_cost) per duplicated category.
 * 2. Annual optimization — monthly subscriptions that COULD be annual.
 *    We apply a 20 % discount factor (typical for SaaS annual plans) to
 *    estimate monthly savings from switching.
 */
export function calculatePotentialSavings(
  subscriptions: Subscription[],
): PotentialSavings {
  const reasons: SavingsReason[] = [];
  let totalMonthly = 0;

  // Rule 1 — duplicate categories
  const byCategory = new Map<string, Subscription[]>();
  for (const sub of subscriptions) {
    if (sub.status !== 'Active') continue;
    const list = byCategory.get(sub.category) ?? [];
    list.push(sub);
    byCategory.set(sub.category, list);
  }

  for (const [category, subs] of byCategory) {
    if (subs.length < 2) continue;
    // sort descending by monthly-equivalent cost
    const sorted = subs
      .map((s) => ({
        name: s.name,
        monthly: normalizeToMonthly(s.monthlyCost, s.billingCycle),
      }))
      .sort((a, b) => b.monthly - a.monthly);

    // savings = 2nd most expensive − cheapest in this group
    const saving = sorted[sorted.length - 2].monthly - sorted[sorted.length - 1].monthly;
    if (saving > 0) {
      totalMonthly += saving;
      reasons.push({
        type: 'duplicate_category',
        category,
        description: `Consolidate ${category} services into one plan`,
        monthlyAmount: Math.round(saving * 100) / 100,
      });
    }
  }

  // Rule 2 — monthly → annual optimization (20 % typical annual discount)
  for (const sub of subscriptions) {
    if (sub.status !== 'Active') continue;
    if (sub.billingCycle !== 'Monthly') continue;
    const monthlyEquivalent = normalizeToMonthly(sub.monthlyCost, sub.billingCycle);
    // 20 % annual discount applied to the monthly cost
    const monthlySaving = monthlyEquivalent * 0.2;
    const rounded = Math.round(monthlySaving * 100) / 100;
    if (rounded > 0) {
      totalMonthly += rounded;
      reasons.push({
        type: 'annual_optimization',
        category: sub.category,
        description: `Switch ${sub.name} to annual billing`,
        monthlyAmount: rounded,
      });
    }
  }

  return {
    monthlyAmount: Math.round(totalMonthly * 100) / 100,
    reasons,
  };
}
