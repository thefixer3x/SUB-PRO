import type { BillingCycle, Subscription, SubscriptionCategory } from '@/types/subscription';

export const BILLING_CYCLES: BillingCycle[] = ['Monthly', 'Annually', 'Quarterly', 'Weekly'];

export const CATEGORIES: SubscriptionCategory[] = [
  'Entertainment',
  'Productivity',
  'AI',
  'Creative',
  'Finance',
  'Utilities',
  'Health',
  'Education',
  'Communication',
  'Other',
];

export interface SubscriptionFormValues {
  name: string;
  /** Amount charged each billing cycle, as typed (e.g. "9.99"). */
  amount: string;
  currency: string;
  billingCycle: BillingCycle;
  /** Next renewal date as YYYY-MM-DD. */
  renewalDate: string;
  category: SubscriptionCategory;
}

export type SubscriptionFormErrors = Partial<Record<keyof SubscriptionFormValues, string>>;

export function emptyForm(today: Date = new Date()): SubscriptionFormValues {
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()));
  return {
    name: '',
    amount: '',
    currency: 'USD',
    billingCycle: 'Monthly',
    renewalDate: next.toISOString().slice(0, 10),
    category: 'Entertainment',
  };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse YYYY-MM-DD as a UTC date; null when it is not a real calendar date. */
export function parseDate(value: string): Date | null {
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function validateSubscriptionForm(values: SubscriptionFormValues): SubscriptionFormErrors {
  const errors: SubscriptionFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Enter the service name.';
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';

  const amountText = values.amount.trim().replace(',', '.');
  const amount = Number(amountText);
  if (!amountText) errors.amount = 'Enter how much you pay.';
  else if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount)) {
    errors.amount = 'Use a number like 9.99.';
  } else if (amount > 100000) errors.amount = 'That amount looks too large.';

  if (!/^[A-Z]{3}$/.test(values.currency.trim().toUpperCase())) {
    errors.currency = 'Use a 3-letter currency code like USD or NGN.';
  }

  if (!parseDate(values.renewalDate)) errors.renewalDate = 'Use the format YYYY-MM-DD.';

  return errors;
}

/**
 * The row to save. `monthlyCost` holds the amount charged each billing cycle
 * (an annual plan stores the yearly price); the totals normalise it to a
 * monthly figure with `normalizeToMonthly`.
 */
export function toNewSubscription(values: SubscriptionFormValues): Omit<Subscription, 'id'> {
  return {
    name: values.name.trim(),
    category: values.category,
    status: 'Active',
    planName: 'Standard',
    monthlyCost: Number(values.amount.trim().replace(',', '.')),
    currency: values.currency.trim().toUpperCase(),
    billingCycle: values.billingCycle,
    renewalDate: parseDate(values.renewalDate) as Date,
    paymentMethod: 'Unknown',
    priority: 'Medium',
  };
}

/** Free-plan cap check, from the real list length (null limit = unlimited). */
export function isAtSubscriptionLimit(count: number, limit: number | null | boolean): boolean {
  return typeof limit === 'number' && count >= limit;
}
