import {
  normalizeToMonthly,
  calculateMonthlyTotal,
  calculateAnnualTotal,
  calculateUpcomingRenewals,
  calculateCategoryBreakdown,
  detectMixedCurrencies,
  calculatePotentialSavings,
  splitByPrimaryCurrency,
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


describe('currency handling', () => {
  it('keeps each subscription in its own currency', () => {
    const subs = [
      sub({ name: 'EUR Plan', monthlyCost: 10, currency: 'EUR' }),
      sub({ name: 'USD Plan', monthlyCost: 10, currency: 'USD' }),
    ];
    expect(subs[0].currency).toBe('EUR');
    expect(subs[1].currency).toBe('USD');
    // Mixed currencies must be detectable so the screen can warn about them.
    expect(detectMixedCurrencies(subs)).toBe(true);
  });

  it('does not treat a single currency as mixed', () => {
    const subs = [
      sub({ name: 'A', monthlyCost: 10, currency: 'NGN' }),
      sub({ name: 'B', monthlyCost: 10, currency: 'NGN' }),
    ];
    expect(detectMixedCurrencies(subs)).toBe(false);
  });
});

describe('calculatePotentialSavings', () => {
  it('returns empty when no subscriptions', () => {
    const result = calculatePotentialSavings([]);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('returns empty when only one active subscription', () => {
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
    // Keep the cheaper plan (14.99/12 = 1.2492); drop the other → save 1.3325
    expect(result.monthlyAmount).toBeCloseTo(1.33, 2);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].type).toBe('duplicate_category');
    expect(result.reasons[0].category).toBe('Entertainment');
  });

  it('sums every dropped plan when 3+ subscriptions share a category (Rule 1)', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Max', monthlyCost: 14.99, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Disney+', monthlyCost: 10.99, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Keep only the cheapest (10.99/12 = 0.9158); drop the other two
    // 1.3325 + 1.2492 = 2.5817 → 2.58
    expect(result.monthlyAmount).toBeCloseTo(2.58, 2);
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
    // Entertainment: keep 18/12 = 1.50, drop 24/12 = 2.00 → 2.00
    // Productivity: keep 6/12 = 0.50, drop 12/12 = 1.00 → 1.00
    // Total: 3.00
    expect(result.monthlyAmount).toBeCloseTo(3.0, 2);
    expect(result.reasons).toHaveLength(2);
  });

  it('ignores inactive subscriptions in duplicate detection', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 18, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'OldService', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment', status: 'Inactive' }),
    ];
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('saves one full plan when duplicates cost the same', () => {
    const subs = [
      sub({ name: 'A', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'B', monthlyCost: 12, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Both cost 1.00/mo. Keeping one and dropping the other still saves 1.00.
    expect(result.monthlyAmount).toBeCloseTo(1.0, 2);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].type).toBe('duplicate_category');
  });

  it('reports NO saving for a monthly plan with no annual counterpart (Rule 2)', () => {
    // There is no annual price in the data model, so nothing can be computed
    // for a service the user only holds on one cycle.
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('compares real per-month prices when the same service is held on two cycles (Rule 2)', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Netflix', monthlyCost: 120, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Annual = 120/12 = 10.00 per month vs monthly 15.99 → saves 5.99
    expect(result.monthlyAmount).toBeCloseTo(5.99, 2);
    const reason = result.reasons.find((r) => r.type === 'annual_optimization');
    expect(reason).toBeDefined();
    expect(reason?.description).toContain('Netflix');
  });

  it('finds the same saving regardless of the order the cycles appear in', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 120, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
    ];
    // Cheapest is 10.00 (annual), dearest 15.99 (monthly) → the saving is real
    // but it is the SAME saving as above; the point is it is derived, not assumed.
    const result = calculatePotentialSavings(subs);
    expect(result.monthlyAmount).toBeCloseTo(5.99, 2);
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
      sub({ name: 'Spotify', monthlyCost: 119.88, billingCycle: 'Annually', category: 'Entertainment' }),
      sub({ name: 'Notion', monthlyCost: 8.99, billingCycle: 'Monthly', category: 'Productivity' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Annual (Spotify): 119.88/12 = 9.99 vs 9.99 monthly → no difference,
    //   so Rule 2 produces nothing and BOTH Spotify legs stay in Rule 1.
    // Duplicate (Entertainment): keep the cheapest at 9.99, drop the rest —
    //   Netflix 15.99 + Max 14.99 + the second Spotify leg 9.99 = 40.97
    // Notion: only one → nothing
    expect(result.monthlyAmount).toBeCloseTo(40.97, 2);
    expect(result.reasons.some((r) => r.type === 'duplicate_category')).toBe(true);
    expect(result.reasons.some((r) => r.type === 'annual_optimization')).toBe(false);
  });

  it('never reports a saving that is not derived from the amounts held', () => {
    // Every reported reason's monthlyAmount must be explainable from the
    // subscription amounts in the input. A monthly plan with no annual
    // counterpart must yield no annual_optimization reason at all.
    const subs = [
      sub({ name: 'Solo Service', monthlyCost: 7.77, billingCycle: 'Monthly', category: 'Utilities' }),
      sub({ name: 'Another', monthlyCost: 3.33, billingCycle: 'Monthly', category: 'Utilities' }),
    ];
    const result = calculatePotentialSavings(subs);

    const inputAmounts = [7.77, 3.33];
    for (const reason of result.reasons) {
      const explained = inputAmounts.some(
        (a) => Math.abs(reason.monthlyAmount - a) < 0.005 || Math.abs(reason.monthlyAmount - (a + inputAmounts[0])) < 0.005,
      );
      expect(explained).toBe(true);
    }
    expect(result.reasons.some((r) => r.type === 'annual_optimization')).toBe(false);
    expect(result.monthlyAmount).toBeCloseTo(7.77, 2);
  });

  it('handles mixed billing cycles in duplicate detection', () => {
    const subs = [
      sub({ name: 'Netflix', monthlyCost: 15.99, billingCycle: 'Monthly', category: 'Entertainment' }),
      sub({ name: 'Disney+', monthlyCost: 120, billingCycle: 'Annually', category: 'Entertainment' }),
    ];
    const result = calculatePotentialSavings(subs);
    // Keep the cheaper (120/12 = 10.00), drop the other (15.99) → 15.99
    expect(result.monthlyAmount).toBeCloseTo(15.99, 2);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].type).toBe('duplicate_category');
  });
});

// ─── splitByPrimaryCurrency ───────────────────────────────────────────────

describe('splitByPrimaryCurrency', () => {
  it('never adds amounts in different currencies together', () => {
    const subs = [
      sub({ name: 'A', monthlyCost: 10, currency: 'USD' }),
      sub({ name: 'B', monthlyCost: 10, currency: 'EUR' }),
    ];
    const split = splitByPrimaryCurrency(subs);
    expect(calculateMonthlyTotal(split.included)).toBe(10);
    expect(calculateMonthlyTotal(split.included)).not.toBe(20);
    expect(split.excluded).toHaveLength(1);
  });

  it('uses the currency most subscriptions are billed in', () => {
    const split = splitByPrimaryCurrency([
      sub({ name: 'A', currency: 'eur' }),
      sub({ name: 'B', currency: 'NGN' }),
      sub({ name: 'C', currency: 'NGN' }),
    ]);
    expect(split.currency).toBe('NGN');
    expect(split.included.map((s) => s.name)).toEqual(['B', 'C']);
    expect(split.otherCurrencies).toEqual(['EUR']);
  });

  it('breaks a tie in favour of the first currency seen', () => {
    const split = splitByPrimaryCurrency([
      sub({ name: 'A', currency: 'GBP' }),
      sub({ name: 'B', currency: 'USD' }),
    ]);
    expect(split.currency).toBe('GBP');
  });

  it('includes everything when there is one currency', () => {
    const subs = [sub({ name: 'A' }), sub({ name: 'B' })];
    const split = splitByPrimaryCurrency(subs);
    expect(split.currency).toBe('USD');
    expect(split.included).toHaveLength(2);
    expect(split.excluded).toHaveLength(0);
    expect(split.otherCurrencies).toEqual([]);
  });

  it('falls back to USD for an empty list', () => {
    expect(splitByPrimaryCurrency([]).currency).toBe('USD');
  });

  it('keeps savings from mixing currencies', () => {
    // Two Entertainment services, but in different currencies: no saving can
    // be computed in one currency, so none is claimed.
    const subs = [
      sub({ name: 'Netflix', category: 'Entertainment', monthlyCost: 15, currency: 'USD' }),
      sub({ name: 'Showmax', category: 'Entertainment', monthlyCost: 9, currency: 'EUR' }),
    ];
    const split = splitByPrimaryCurrency(subs);
    expect(calculatePotentialSavings(split.included).monthlyAmount).toBe(0);
  });
});
