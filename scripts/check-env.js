const path = require('path');
const dotenv = require('dotenv');

// Mirror Expo's local env loading so this diagnostic matches real builds.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const getProjectRefFromUrl = (value) => {
  try {
    return new URL(value).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
};

const getProjectRefFromAnonKey = (value) => {
  const payload = value?.split('.')?.[1];
  if (!payload) {
    return null;
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;

  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')).ref || null;
  } catch {
    return null;
  }
};

// Simple test script to verify environment variables
console.log('Environment Variables Check:');
console.log('==========================');

// Check Supabase variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseUrlRef = getProjectRefFromUrl(supabaseUrl);
const supabaseKeyRef = getProjectRefFromAnonKey(supabaseAnonKey);

// Publishable keys (sb_publishable_...) are not JWTs and carry no project `ref` claim, so the ref
// comparison below cannot apply to them. Legacy anon JWTs keep the original check.
const isPublishableKey = (value) => typeof value === 'string' && value.startsWith('sb_publishable_');
const REDACTED_KEY = '***REMOVED-SUPABASE-CREDENTIAL***';
const keyLooksUsable =
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== REDACTED_KEY &&
  (isPublishableKey(supabaseAnonKey) || supabaseAnonKey.split('.').length === 3);
const supabaseRefsMatch = isPublishableKey(supabaseAnonKey)
  ? true
  : Boolean(supabaseUrlRef) && Boolean(supabaseKeyRef) && supabaseUrlRef === supabaseKeyRef;

console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl || 'NOT SET');
console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey || 'NOT SET');
if (supabaseUrl && supabaseAnonKey) {
  console.log('Supabase URL Ref:', supabaseUrlRef || 'UNREADABLE');
  console.log('Supabase Key Ref:', supabaseKeyRef || 'UNREADABLE');
  console.log('Supabase Refs Match:', supabaseRefsMatch);
}

// Check Stripe variables
console.log('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'NOT SET');

// Check if variables are properly configured
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseRefsMatch);
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
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  // Stripe can be optional depending on feature flags; enforce only if your app requires it at build time
  // if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) missing.push('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');

  if (missing.length > 0) {
    console.error('\nERROR: Missing required environment variables in CI:', missing.join(', '));
    console.error('Set them in Netlify → Site configuration → Environment variables, or via CLI:');
    console.error('  netlify env:set EXPO_PUBLIC_SUPABASE_URL https://mxtsdgkwzjzlttpotole.supabase.co');
    console.error('  netlify env:set EXPO_PUBLIC_SUPABASE_ANON_KEY <your-anon-key>');
    process.exit(1);
  }

  if (supabaseUrl && supabaseAnonKey && !keyLooksUsable) {
    console.error('\nERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY is not a usable public key.');
    console.error('  Expected sb_publishable_... (current format) or a legacy anon JWT.');
    console.error('  A redacted placeholder, an empty value, or a sb_secret_ key will always fail at runtime.');
    process.exit(1);
  }

  if (supabaseUrl && supabaseAnonKey && !supabaseRefsMatch) {
    console.error('\nERROR: Supabase URL and anon key belong to different projects.');
    console.error(`  URL project ref: ${supabaseUrlRef || 'UNREADABLE'}`);
    console.error(`  Key project ref: ${supabaseKeyRef || 'UNREADABLE'}`);
    process.exit(1);
  }
}
