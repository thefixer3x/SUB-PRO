console.log('Supabase Environment Configuration Check:');
console.log('========================================');

// Check if environment variables are set
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

if (supabaseUrl && supabaseAnonKey) {
  const urlRef = getProjectRefFromUrl(supabaseUrl);
  const keyRef = getProjectRefFromAnonKey(supabaseAnonKey);
  const refsMatch = Boolean(urlRef) && Boolean(keyRef) && urlRef === keyRef;

  console.log('✅ Supabase environment variables are set');
  if (refsMatch) {
    console.log('✅ Authentication should work');
  } else {
    console.log('❌ Authentication is likely broken: URL and anon key belong to different Supabase projects');
    console.log(`Supabase URL Ref: ${urlRef || 'UNREADABLE'}`);
    console.log(`Supabase Key Ref: ${keyRef || 'UNREADABLE'}`);
  }
  console.log(`Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`Supabase Anon Key: ${supabaseAnonKey.substring(0, 10)}...`);
} else {
  console.log('❌ Supabase environment variables are NOT set');
  console.log('❌ Authentication will NOT work');
  console.log('Missing variables:');
  if (!supabaseUrl) console.log('  - EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) console.log('  - EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.log('\nTo fix this issue:');
  console.log('1. Create a .env file in your project root');
  console.log('2. Add the following variables:');
  console.log('   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url');
  console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
}
