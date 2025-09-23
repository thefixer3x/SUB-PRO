// Simple test script to verify environment variables
console.log('Environment Variables Check:');
console.log('==========================');

// Check Supabase variables
console.log('EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL || 'NOT SET');
console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'NOT SET');

// Check Stripe variables
console.log('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'NOT SET');

// Check if variables are properly configured
const isSupabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
console.log('Supabase Configured:', isSupabaseConfigured);

const isStripeConfigured = !!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
console.log('Stripe Configured:', isStripeConfigured);

console.log('\nTo fix missing environment variables:');
console.log('1. Create a .env file in your project root with the required variables');
console.log('2. Or set them in your deployment platform (Vercel, Netlify, etc.)');