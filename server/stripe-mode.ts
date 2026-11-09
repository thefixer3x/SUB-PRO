/** True only when the server's Stripe key is explicitly a test-mode key. */
export function isStripeTestMode(secretKey = process.env.STRIPE_SECRET_KEY): boolean {
  return typeof secretKey === 'string' && /^(sk|rk)_test_/.test(secretKey);
}
