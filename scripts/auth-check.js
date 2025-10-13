// Simple test to check if authentication is working
const { isSupabaseEnvConfigured, supabase } = require('./lib/supabase');

console.log('=== Authentication System Check ===');

// Check if Supabase is configured
console.log('Supabase Environment Configured:', isSupabaseEnvConfigured);

if (!isSupabaseEnvConfigured) {
  console.log('❌ AUTHENTICATION SYSTEM NOT CONFIGURED');
  console.log('');
  console.log('REASON: Your .env file contains placeholder values:');
  console.log('  EXPO_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co');
  console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key');
  console.log('');
  console.log('IMPACT: Sign-up and sign-in buttons will not work');
  console.log('');
  console.log('SOLUTION:');
  console.log('1. Create a Supabase project at https://supabase.com');
  console.log('2. Get your project URL and anon key from Project Settings > API');
  console.log('3. Update your .env file with real credentials:');
  console.log('   EXPO_PUBLIC_SUPABASE_URL=your_real_supabase_project_url');
  console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_real_supabase_anon_key');
} else {
  console.log('✅ Supabase is properly configured');
  console.log('Testing connection...');
  
  // Test connection (this will fail with placeholder values)
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.log('❌ Connection failed:', error.message);
      } else {
        console.log('✅ Connection successful');
        console.log('Session exists:', !!data.session);
      }
    })
    .catch(error => {
      console.log('❌ Connection error:', error.message);
    });
}

console.log('');
console.log('=== End Check ===');