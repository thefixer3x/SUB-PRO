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
