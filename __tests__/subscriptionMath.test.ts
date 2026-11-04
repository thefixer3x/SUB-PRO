import {
  normalizeToMonthly,
  calculateMonthlyTotal,
  calculateAnnualTotal,
  calculateUpcomingRenewals,
  calculateCategoryBreakdown,
  detectMixedCurrencies,
  DashboardStats,
  getDashboardStats,
} from '../utils/subscriptionMath';
import type { Subscription } from '../types/subscription';

const baseDate = new Date('2026-11-04T00:00:00Z');

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 'mock-id',
    name: partial.name ?? 'Test',
    category: partial.category ?? 'Other',
    status: partial.status ?? 'Active',
    planName: partial.planName ?? 'Default',
    monthlyCost: partial.monthlyCost ?? 10,
    currency: partial.currency ?? 'USD',
    billingCycle: partial.billingCycle ?? 'Monthly',
    renewalDate: partial.renewalDate ?? new Date('2026-12-01T00:00:00Z'),
    paymentMethod: partial.paymentMethod ?? 'Visa',
    priority: partial.priority ?? 'Medium',
    ...partial,
  } as Subscription;
}

describe('normalizeToMonthly', () => {
  it('returns the cost unchanged for Monthly billing', () => {
    expect(normalizeToMonthly(10, 'Monthly')).toBe(10);
  });

  it('converts Weekly to monthly (x52/12)', () => {
    // 5/week -> 5*52/12 = 21.666...
    expect(normalizeToMonthly(5, 'Weekly')).toBeCloseTo(5 * 52 / 12);
  });

  it('converts Quarterly to monthly (/3)', () => {
    expect(normalizeToMonthly(30, 'Quarterly')).toBe(10);
  });

  it('converts Annually to monthly (/12)', () => {
    expect(normalizeToMonthly(120, 'Annually')).toBe(10);
  });

  it('handles zero cost', () => {
    expect(normalizeToMonthly(0, 'Annually')).toBe(0);
  });
});

describe('calculateMonthlyTotal', () => {
  it('sums monthly subscriptions', () => {
    const subscriptions = [
      sub({ name: 'A', monthlyCost: 10, billingCycle: 'Monthly', category: 'Other' }),
      sub({ name: 'B', monthlyCost: 20, billingCycle: 'Monthly', category: 'Other' }),
    ];
    expect(calculateMonthlyTotal(subscriptions)).toBe(30);
  });

  it('normalises a yearly plan /12', () => {
    const subscriptions = [
      sub({ name: 'Yearly', monthlyCost: 120, billingCycle: 'Annually', category: 'Other' }),
    ];
    expect(calculateMonthlyTotal(subscriptions)).toBe(10);
  });

  it('normalises a weekly plan x52/12', () => {
    const subscriptions = [
      sub({ name: 'Weekly', monthlyCost: 5, billingCycle: 'Weekly', category: 'Other' }),
    ];
    expect(calculateMonthlyTotal(subscriptions)).toBeCloseTo(5 * 52 / 12);
  });

  it('mixes billing cycles correctly', () => {
    const subscriptions = [
      sub({ name: 'M', monthlyCost: 10, billingCycle: 'Monthly', category: 'Other' }),
      sub({ name: 'Q', monthlyCost: 30, billingCycle: 'Quarterly', category: 'Other' }),
      sub({ name: 'Y', monthlyCost: 120, billingCycle: 'Annually', category: 'Other' }),
    ];
    // 10 + 10 + 10 = 30
    expect(calculateMonthlyTotal(subscriptions)).toBe(30);
  });

  it('returns 0 for empty array', () => {
    expect(calculateMonthlyTotal([])).toBe(0);
  });
});

describe('calculateAnnualTotal', () => {
  it('multiplies monthly total by 12', () => {
    expect(calculateAnnualTotal(10)).toBe(120);
  });

  it('returns 0 for 0 input', () => {
    expect(calculateAnnualTotal(0)).toBe(0);
  });
});

describe('calculateUpcomingRenewals', () => {
  const sevenDaysFromBase = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  it('finds renewals within 7 days', () => {
    const subscriptions = [
      sub({ name: 'Soon', monthlyCost: 10, renewalDate: new Date('2026-11-06T00:00:00Z') }),
      sub({ name: 'Later', monthlyCost: 10, renewalDate: new Date('2026-12-01T00:00:00Z') }),
    ];
    const upcoming = calculateUpcomingRenewals(subscriptions, 7, baseDate);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]?.name).toBe('Soon');
  });

  it('returns empty when no renewals in window', () => {
    const subscriptions = [
      sub({ name: 'Far', monthlyCost: 10, renewalDate: new Date('2026-12-15T00:00:00Z') }),
    ];
    expect(calculateUpcomingRenewals(subscriptions, 7, baseDate)).toEqual([]);
  });

  it('returns empty for empty input', () => {
    expect(calculateUpcomingRenewals([], 7, baseDate)).toEqual([]);
  });

  it('respects custom day window', () => {
    const subscriptions = [
      sub({ name: 'Day5', monthlyCost: 10, renewalDate: new Date('2026-11-09T00:00:00Z') }),
      sub({ name: 'Day10', monthlyCost: 10, renewalDate: new Date('2026-11-14T00:00:00Z') }),
    ];
    const within5 = calculateUpcomingRenewals(subscriptions, 5, baseDate);
    expect(within5).toHaveLength(1);
    expect(within5[0]?.name).toBe('Day5');
  });
});

describe('calculateCategoryBreakdown', () => {
  it('groups by category', () => {
    const subscriptions = [
      sub({ name: 'A', monthlyCost: 10, category: 'Entertainment' }),
      sub({ name: 'B', monthlyCost: 20, category: 'Entertainment' }),
      sub({ name: 'C', monthlyCost: 5, category: 'Productivity' }),
    ];
    const breakdown = calculateCategoryBreakdown(subscriptions);
    expect(breakdown).toHaveLength(2);
    const streaming = breakdown.find(b => b.category === 'Entertainment');
    const productivity = breakdown.find(b => b.category === 'Productivity');
    expect(streaming?.amount).toBe(30);
    expect(productivity?.amount).toBe(5);
  });

  it('calculates percentages that sum to ~100', () => {
    const subscriptions = [
      sub({ name: 'A', monthlyCost: 30, category: 'Entertainment' }),
      sub({ name: 'B', monthlyCost: 10, category: 'Productivity' }),
    ];
    const breakdown = calculateCategoryBreakdown(subscriptions);
    const totalPct = breakdown.reduce((s, b) => s + b.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 1);
  });

  it('returns empty for empty input', () => {
    expect(calculateCategoryBreakdown([])).toEqual([]);
  });
});

describe('detectMixedCurrencies', () => {
  it('returns false when all subscriptions share the same currency', () => {
    const subscriptions = [
      sub({ name: 'A', monthlyCost: 10, currency: 'USD' }),
      sub({ name: 'B', monthlyCost: 20, currency: 'USD' }),
    ];
    expect(detectMixedCurrencies(subscriptions)).toBe(false);
  });

  it('returns true when currencies differ', () => {
    const subscriptions = [
      sub({ name: 'A', monthlyCost: 10, currency: 'USD' }),
      sub({ name: 'B', monthlyCost: 20, currency: 'EUR' }),
    ];
    expect(detectMixedCurrencies(subscriptions)).toBe(true);
  });

  it('handles empty input as not mixed', () => {
    expect(detectMixedCurrencies([])).toBe(false);
  });
});

describe('getDashboardStats (integration)', () => {
  it('returns empty stats for empty subscriptions', () => {
    const stats = getDashboardStats([]);
    expect(stats.monthlyTotal).toBe(0);
    expect(stats.annualTotal).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.upcomingRenewals).toEqual([]);
    expect(stats.categoryBreakdown).toEqual([]);
    expect(stats.mixedCurrencies).toBe(false);
  });

  it('computes full dashboard stats for mixed billing cycles', () => {
    const now = new Date('2026-11-04T00:00:00Z');
    const subscriptions: Subscription[] = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment', currency: 'USD', renewalDate: new Date('2026-11-06T00:00:00Z') }),
      sub({ name: 'Adobe', monthlyCost: 120, billingCycle: 'Annually', category: 'Creative', currency: 'USD', renewalDate: new Date('2026-12-01T00:00:00Z') }),
      sub({ name: 'Spotify', monthlyCost: 9.99, billingCycle: 'Monthly', category: 'Entertainment', currency: 'EUR', renewalDate: new Date('2026-11-20T00:00:00Z') }),
    ];
    const stats = getDashboardStats(subscriptions, 7, now);
    expect(stats.activeCount).toBe(3);
    expect(stats.mixedCurrencies).toBe(true);
    // Netflix: 15.99 + Adobe: 120/12 = 10 + Spotify: 9.99 = 35.98
    expect(stats.monthlyTotal).toBeCloseTo(35.98, 1);
    expect(stats.annualTotal).toBeCloseTo(35.98 * 12, 1);
    expect(stats.upcomingRenewals).toHaveLength(1); // Netflix only (2 days)
    expect(stats.upcomingRenewals[0]?.name).toBe('Netflix');
  });
});

// ─── calculatePotentialSavings ─────────────────────────────────────────────

import { calculatePotentialSavings } from '../utils/subscriptionMath';

describe('calculatePotentialSavings', () => {
  it('returns empty when no subscriptions', () => {
    const result = calculatePotentialSavings([]);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('returns empty when only one active subscription (no duplicate, non-monthly)', () => {
    const subs = [sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Annually', category: 'Entertainment' })];
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('detects two subscriptions in the same category (Rule 1)', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Max', monthlyCost: 14.99, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Netflix: 15.99/12 = 1.3325, Max: 14.99/12 = 1.2492
    // savings = 1.3325 − 1.2492 = 0.0833 → rounds to 0.08
    expect(result.monthlyAmount).toBeCloseTo(0.08, 2);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].type).toBe('duplicate_category');
    expect(result.reasons[0].category).toBe('Entertainment');
  });

  it('detects multiple subscriptions in same category (3+)', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Max', monthlyCost: 14.99, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Disney+', monthlyCost: 10.99, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // sorted: 1.3325, 1.2492, 0.9158
    // savings = 1.2492 − 0.9158 = 0.3333 → rounds to 0.33
    expect(result.monthlyAmount).toBeCloseTo(0.33, 2);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].description).toContain('Entertainment');
  });

  it('accumulates duplicate savings across multiple categories', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 24, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Max', monthlyCost: 18, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Asana', monthlyCost: 12, billingCycle: 'Annually', category: 'Productivity' }),
      sub({ name: 'Notion', monthlyCost: 6, billingCycle: 'Annually', category: 'Productivity' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Entertainment: 18/12 − 12/12 = 1.50 − 1.00 = 0.50
    // Productivity: 12/12 − 6/12 = 1.00 − 0.50 = 0.50
    // Total: 1.00
    expect(result.monthlyAmount).toBeCloseTo(1.0, 2);
    expect(result.reasons).toHaveLength(2);
  });

  it('ignores inactive subscriptions in duplicate detection', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 18, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'OldService', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment', status: 'Inactive' }),
    ];
    const result = calculatePotentialSavings(subs);
    // OldService is inactive → only Netflix in category → no duplicate
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('ignores zero-saving duplicates (same price)', () => {
    const subs = [
      sub({ name: 'A', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'B', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // 1 − 1 = 0 → no savings
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('estimates savings for monthly subscriptions (Rule 2)', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBeCloseTo(3.20, 2);
    expect(result.reasons[0].type).toBe('annual_optimization');
    expect(result.reasons[0].description).toContain('Netflix');
  });

  it('excludes already-annual subscriptions from annual optimization', () => {
    const subs = [
      sub({ name: 'Adobe', monthlyCost: 120, billingCycle: 'Annually', category: 'Creative' }),
    ];
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('mixes duplicate and annual rules', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Max', monthlyCost: 14.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Spotify', monthlyCost: 9.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Notion', monthlyCost: 8.99, billingCycle: 'Monthly', category: 'Productivity' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Duplicate (Entertainment): 14.99 − 9.99 = 5.00
    // Annual: 15.99×0.2=3.20 + 14.99×0.2=3.00 + 9.99×0.2=2.00 + 8.99×0.2=1.80 = 10.00
    // Total: 15.00
    expect(result.monthlyAmount).toBeCloseTo(15.00, 2);
    expect(result.reasons).toHaveLength(5);
    expect(result.reasons.some((r) => r.type === 'duplicate_category')).toBe(true);
    expect(result.reasons.some((r) => r.type === 'annual_optimization')).toBe(true);
  });

  it('handles mixed billing cycles in duplicate detection', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Disney+', monthlyCost: 120, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Duplicate (Entertainment): 15.99 − 120/12 = 15.99 − 10.00 = 5.99
    // Annual (Netflix monthly): 15.99 × 0.2 = 3.20
    // Total: 9.19
    expect(result.monthlyAmount).toBeCloseTo(9.19, 2);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0].type).toBe('duplicate_category');
  });
});
