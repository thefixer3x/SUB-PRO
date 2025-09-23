import { isSupabaseEnvConfigured, supabase } from './lib/supabase';

console.log('=== Authentication Debug Test ===');
console.log('Supabase Environment Configured:', isSupabaseEnvConfigured);

if (!isSupabaseEnvConfigured) {
  console.log('❌ Supabase is NOT properly configured');
  console.log('This is why the sign-up button is not working!');
  console.log('');
  console.log('To fix this issue:');
  console.log('1. Create a .env file in your project root');
  console.log('2. Add your Supabase credentials:');
  console.log('   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url');
  console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.log('');
  console.log('You can find these in your Supabase project dashboard under Project Settings > API');
} else {
  console.log('✅ Supabase is properly configured');
  console.log('Testing basic connection...');
  
  // Test if we can connect to Supabase
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.log('❌ Error connecting to Supabase:', error.message);
      } else {
        console.log('✅ Successfully connected to Supabase');
        console.log('Session exists:', !!data.session);
      }
    })
    .catch(error => {
      console.log('❌ Unexpected error:', error.message);
    });
}

console.log('');
console.log('=== End Debug Test ===');