// Server-side only Stripe utilities
// This file should only be imported in API routes
import Stripe from 'stripe';

export const createServerStripe = () => {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  });
};

export const stripe = createServerStripe();