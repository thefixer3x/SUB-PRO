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

// In CI (e.g., Netlify), fail the build if required env vars are missing
const runningInCI = Boolean(process.env.CI || process.env.NETLIFY);
if (runningInCI) {
  const missing = [];
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  // Stripe can be optional depending on feature flags; enforce only if your app requires it at build time
  // if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) missing.push('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');

  if (missing.length > 0) {
    console.error('\nERROR: Missing required environment variables in CI:', missing.join(', '));
    console.error('Set them in Netlify → Site configuration → Environment variables, or via CLI:');
    console.error('  netlify env:set EXPO_PUBLIC_SUPABASE_URL https://mxtsdgkwzjzlttpotole.supabase.co');
    console.error('  netlify env:set EXPO_PUBLIC_SUPABASE_ANON_KEY <your-anon-key>');
    process.exit(1);
  }
}