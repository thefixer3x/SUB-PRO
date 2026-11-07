import { isStripeTestMode } from '../server/stripe-mode';

describe('isStripeTestMode', () => {
  it.each(['sk_test_abc', 'rk_test_abc'])('accepts an explicit test key: %s', (key) => {
    expect(isStripeTestMode(key)).toBe(true);
  });

  it.each(['sk_live_abc', 'rk_live_abc', '', undefined])('rejects a non-test key: %s', (key) => {
    expect(isStripeTestMode(key)).toBe(false);
  });
});
