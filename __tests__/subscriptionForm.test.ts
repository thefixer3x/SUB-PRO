import {
  emptyForm,
  isAtSubscriptionLimit,
  parseDate,
  toNewSubscription,
  validateSubscriptionForm,
} from '@/utils/subscriptionForm';

const valid = {
  ...emptyForm(new Date('2026-11-10T00:00:00Z')),
  name: 'Netflix',
  amount: '15.49',
};

describe('subscription form', () => {
  it('defaults the renewal to one month from today', () => {
    expect(emptyForm(new Date('2026-11-10T00:00:00Z')).renewalDate).toBe('2026-12-10');
  });

  it('accepts a complete form', () => {
    expect(validateSubscriptionForm(valid)).toEqual({});
  });

  it('requires a name and a sensible amount', () => {
    const errors = validateSubscriptionForm({ ...valid, name: '  ', amount: 'abc' });
    expect(errors.name).toBeTruthy();
    expect(errors.amount).toBeTruthy();
    expect(validateSubscriptionForm({ ...valid, amount: '-5' }).amount).toBeTruthy();
    expect(validateSubscriptionForm({ ...valid, amount: '9.999' }).amount).toBeTruthy();
    expect(validateSubscriptionForm({ ...valid, amount: '9,99' })).toEqual({});
  });

  it('rejects impossible dates and bad currency codes', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(validateSubscriptionForm({ ...valid, renewalDate: '12/01/2026' }).renewalDate).toBeTruthy();
    expect(validateSubscriptionForm({ ...valid, currency: 'US' }).currency).toBeTruthy();
  });

  it('stores the amount per billing cycle, uppercased currency and the chosen date', () => {
    const sub = toNewSubscription({ ...valid, amount: '99,00', currency: 'ngn', billingCycle: 'Annually' });
    expect(sub).toMatchObject({
      name: 'Netflix',
      monthlyCost: 99,
      currency: 'NGN',
      billingCycle: 'Annually',
      status: 'Active',
    });
    expect(sub.renewalDate.toISOString().slice(0, 10)).toBe('2026-12-10');
  });

  it('applies the plan cap from the real list length', () => {
    expect(isAtSubscriptionLimit(4, 5)).toBe(false);
    expect(isAtSubscriptionLimit(5, 5)).toBe(true);
    expect(isAtSubscriptionLimit(500, null)).toBe(false);
  });
});
