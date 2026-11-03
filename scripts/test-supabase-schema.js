#!/usr/bin/env node

/**
 * Test Supabase Schema Script
 * Tests the complete database schema and table structures with secure environment variable usage
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Secure environment variable usage
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validation
if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL environment variable is not set');
  console.log('💡 Please set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL in your .env file');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('❌ Error: SUPABASE_ANON_KEY environment variable is not set');
  console.log('💡 Please set SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseSchema() {
  console.log('🏗️  Testing Supabase Database Schema...\n');

  try {
    // Test 1: Check connection
    console.log('🔌 Test 1: Checking Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message);
      return false;
    }
    console.log('✅ Supabase connection successful');

    // Test 2: List all tables
    console.log('\n📋 Test 2: Checking database tables...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_schema_tables');

    if (tablesError) {
      console.log('⚠️  Could not retrieve table list:', tablesError.message);
      console.log('📝 Checking known tables manually...');
      
      // Check common tables manually
      const knownTables = ['profiles', 'subscriptions', 'virtual_cards', 'transactions', 'notifications'];
      for (const tableName of knownTables) {
        try {
          const { error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (tableError) {
            console.log(`❌ Table '${tableName}': ${tableError.message}`);
          } else {
            console.log(`✅ Table '${tableName}': accessible`);
          }
        } catch (err) {
          console.log(`❌ Table '${tableName}': ${err.message}`);
        }
      }
    } else {
      console.log('✅ Retrieved table schema');
      if (tables && tables.length > 0) {
        console.log('📊 Available tables:');
        tables.forEach(table => {
          console.log(`  - ${table.table_name} (${table.table_schema || 'public'})`);
        });
      }
    }

    // Test 3: Check profiles table structure
    console.log('\n👤 Test 3: Analyzing profiles table structure...');
    const { data: profileColumns, error: profileError } = await supabase
      .rpc('get_table_columns', { table_name: 'profiles' });

    if (profileError) {
      console.log('⚠️  Could not get profiles structure:', profileError.message);
    } else {
      console.log('✅ Profiles table structure:');
      if (profileColumns && profileColumns.length > 0) {
        profileColumns.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
        });
      }
    }

    // Test 4: Check RLS (Row Level Security) policies
    console.log('\n🔒 Test 4: Checking Row Level Security policies...');
    const { data: rlsPolicies, error: rlsError } = await supabase
      .rpc('get_rls_policies', { table_name: 'profiles' });

    if (rlsError) {
      console.log('⚠️  Could not check RLS policies:', rlsError.message);
      console.log('📝 This is expected if RLS functions are not available');
    } else {
      if (rlsPolicies && rlsPolicies.length > 0) {
        console.log('✅ RLS policies found:');
        rlsPolicies.forEach(policy => {
          console.log(`  - ${policy.policy_name}: ${policy.command} (${policy.roles})`);
        });
      } else {
        console.log('⚠️  No RLS policies found - consider adding security policies');
      }
    }

    // Test 5: Check indexes and performance
    console.log('\n⚡ Test 5: Checking database indexes...');
    const { data: indexes, error: indexError } = await supabase
      .rpc('get_table_indexes', { table_name: 'profiles' });

    if (indexError) {
      console.log('⚠️  Could not check indexes:', indexError.message);
    } else {
      if (indexes && indexes.length > 0) {
        console.log('✅ Database indexes:');
        indexes.forEach(index => {
          console.log(`  - ${index.index_name}: ${index.columns} (${index.index_type})`);
        });
      } else {
        console.log('📝 No custom indexes found');
      }
    }

    // Test 6: Basic CRUD operations test
    console.log('\n🧪 Test 6: Testing basic CRUD operations...');
    const testId = 'schema-test-' + Date.now();
    
    try {
      // Create
      const { data: createData, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: testId,
          email: `schema-test-${Date.now()}@example.com`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (createError) {
        console.log('❌ CREATE operation failed:', createError.message);
      } else {
        console.log('✅ CREATE operation successful');
        
        // Update
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', testId)
          .select();

        if (updateError) {
          console.log('❌ UPDATE operation failed:', updateError.message);
        } else {
          console.log('✅ UPDATE operation successful');
        }

        // Delete (cleanup)
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', testId);

        if (deleteError) {
          console.log('⚠️  DELETE operation failed:', deleteError.message);
        } else {
          console.log('✅ DELETE operation successful');
        }
      }
    } catch (crudError) {
      console.log('❌ CRUD test error:', crudError.message);
    }

    return true;

  } catch (error) {
    console.error('💥 Unexpected error during schema testing:', error);
    return false;
  }
}

async function main() {
  console.log('🔐 Using environment variables for Supabase connection');
  console.log(`📍 Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
  console.log(`🔑 API Key: ${supabaseAnonKey?.substring(0, 20)}...\n`);

  const success = await testSupabaseSchema();
  
  if (success) {
    console.log('\n🎉 Database schema testing completed!');
    console.log('💡 Review any warnings above to improve your database setup');
    process.exit(0);
  } else {
    console.log('\n💔 Schema testing encountered errors. Please check the logs above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSupabaseSchema };
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="fc4bdfa7-86c3-566a-b632-eb7b47a48375")}catch(e){}}();
//# debugId=fc4bdfa7-86c3-566a-b632-eb7b47a48375
