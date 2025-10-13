console.log('Supabase Environment Configuration Check:');
console.log('========================================');

// Check if environment variables are set
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  console.log('✅ Supabase environment variables are set');
  console.log('✅ Authentication should work');
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