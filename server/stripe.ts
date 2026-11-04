/**
 * Stripe client singleton for Vercel functions.
 *
 * Reads STRIPE_SECRET_KEY from the environment at module load time,
 * so tests can override it before importing the handlers.
 */

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn('STRIPE_SECRET_KEY is not configured. Stripe operations will fail.');
}

export const stripe = secretKey
  ? new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
    })
  : undefined;

/** Ensure Stripe is configured; throws if not. */
export const ensureStripe = (): Stripe => {
  if (!stripe) {
    throw new Error('Stripe client is not configured.');
  }
  return stripe;
};
