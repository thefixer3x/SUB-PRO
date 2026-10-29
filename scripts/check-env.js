// Build-time gate for the public Supabase config baked into the web bundle.
// Metro only inlines EXPO_PUBLIC_* variables, so NEXT_PUBLIC_* / plain names never reach the client.
console.log('Environment Variables Check:');
console.log('==========================');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const legacyAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const describeKey = (key) => {
  if (!key) return 'NOT SET';
  if (key.startsWith('sb_publishable_')) return 'set (publishable)';
  if (key.startsWith('sb_secret_')) return 'set (SECRET KEY - must not be public)';
  if (key.startsWith('eyJ')) return 'set (legacy JWT)';
  return 'set (unrecognised format)';
};

console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl || 'NOT SET');
console.log('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', describeKey(publishableKey));
console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY (legacy):', describeKey(legacyAnonKey));
console.log('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'set' : 'NOT SET');

// Legacy keys are JWTs; read the role claim (no signature check needed to reject one).
const jwtRole = (key) => {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role;
  } catch {
    return undefined;
  }
};

const problems = [];
if (!supabaseUrl) {
  problems.push('EXPO_PUBLIC_SUPABASE_URL is not set');
} else {
  try {
    new URL(supabaseUrl);
  } catch {
    problems.push('EXPO_PUBLIC_SUPABASE_URL is not a valid absolute URL (the bundle would fall back to a placeholder client)');
  }
}
if (!publishableKey && !legacyAnonKey) {
  problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set (the bundle would fall back to a placeholder client)');
}
if (publishableKey && !publishableKey.startsWith('sb_publishable_')) {
  problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be an sb_publishable_ key');
}
if (
  [publishableKey, legacyAnonKey].some(
    (key) => key.startsWith('sb_secret_') || (key.startsWith('eyJ') && jwtRole(key) === 'service_role'),
  )
) {
  problems.push('A Supabase secret key is set in an EXPO_PUBLIC_* variable and would ship to browsers');
}
if (process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SECRET_KEY) {
  problems.push('Remove EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_SUPABASE_SECRET_KEY: EXPO_PUBLIC_* values are public');
}

const runningInCI = Boolean(process.env.CI || process.env.NETLIFY || process.env.VERCEL);

if (problems.length > 0) {
  console.error('\nSupabase environment problems:');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  if (runningInCI) {
    console.error('\nFailing the build so a broken auth bundle is never deployed.');
    process.exit(1);
  }
} else {
  console.log('\nSupabase public config looks valid.');
}
