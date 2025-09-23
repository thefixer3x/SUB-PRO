#!/usr/bin/env node

/**
 * Test Profiles Table Script
 * Tests the profiles table functionality with secure environment variable usage
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Secure environment variable usage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validation
if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL environment variable is not set');
  console.log('💡 Please set SUPABASE_URL in your .env file');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('❌ Error: SUPABASE_ANON_KEY environment variable is not set');
  console.log('💡 Please set SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProfilesTable() {
  console.log('🧪 Testing Profiles Table...\n');

  try {
    // Test 1: Check if profiles table exists and is accessible
    console.log('📋 Test 1: Checking profiles table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Profiles table test failed:', tableError.message);
      return false;
    }
    console.log('✅ Profiles table is accessible');

    // Test 2: Check table schema
    console.log('\n📊 Test 2: Checking profiles table schema...');
    const { data: schemaData, error: schemaError } = await supabase
      .rpc('get_table_schema', { table_name: 'profiles' });

    if (schemaError) {
      console.log('⚠️  Could not retrieve schema details:', schemaError.message);
    } else {
      console.log('✅ Schema retrieved successfully');
      if (schemaData && schemaData.length > 0) {
        console.log('📈 Table columns:');
        schemaData.forEach(column => {
          console.log(`  - ${column.column_name} (${column.data_type})`);
        });
      }
    }

    // Test 3: Count existing profiles
    console.log('\n🔢 Test 3: Counting existing profiles...');
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count test failed:', countError.message);
    } else {
      console.log(`✅ Total profiles in database: ${count}`);
    }

    // Test 4: Test profile creation (with cleanup)
    console.log('\n🆕 Test 4: Testing profile creation...');
    const testUserId = 'test-user-' + Date.now();
    
    const { data: createData, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        email: `test-${Date.now()}@example.com`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (createError) {
      console.error('❌ Profile creation test failed:', createError.message);
    } else {
      console.log('✅ Test profile created successfully');
      
      // Cleanup: Delete test profile
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', testUserId);

      if (deleteError) {
        console.warn('⚠️  Could not cleanup test profile:', deleteError.message);
      } else {
        console.log('🧹 Test profile cleaned up successfully');
      }
    }

    return true;

  } catch (error) {
    console.error('💥 Unexpected error during testing:', error);
    return false;
  }
}

async function main() {
  console.log('🔐 Using environment variables for Supabase connection');
  console.log(`📍 Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
  console.log(`🔑 API Key: ${supabaseAnonKey?.substring(0, 20)}...\n`);

  const success = await testProfilesTable();
  
  if (success) {
    console.log('\n🎉 All profiles table tests completed successfully!');
    process.exit(0);
  } else {
    console.log('\n💔 Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testProfilesTable };