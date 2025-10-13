#!/usr/bin/env node

/**
 * Check and Fix Profiles Script
 * Diagnoses and fixes common issues with the profiles table using secure environment variables
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

async function checkProfilesTable() {
  console.log('🔍 Checking profiles table for issues...\n');

  const issues = [];
  const fixes = [];

  try {
    // Check 1: Table exists and is accessible
    console.log('📋 Check 1: Profiles table accessibility...');
    const { data: tableTest, error: tableError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      issues.push({
        severity: 'critical',
        issue: 'Profiles table is not accessible',
        details: tableError.message,
        fix: 'Create profiles table or check permissions'
      });
      console.error('❌ Critical: Profiles table not accessible');
      return { issues, fixes };
    }
    console.log('✅ Profiles table is accessible');

    // Check 2: Look for profiles with missing required fields
    console.log('\n📊 Check 2: Missing required fields...');
    const { data: missingEmailProfiles, error: emailError } = await supabase
      .from('profiles')
      .select('id, email, created_at')
      .or('email.is.null,email.eq."""');

    if (emailError) {
      console.log('⚠️  Could not check email fields:', emailError.message);
    } else if (missingEmailProfiles && missingEmailProfiles.length > 0) {
      issues.push({
        severity: 'high',
        issue: `${missingEmailProfiles.length} profiles missing email addresses`,
        details: missingEmailProfiles.map(p => `ID: ${p.id}`).join(', '),
        fix: 'Update profiles to include valid email addresses'
      });
      console.log(`⚠️  Found ${missingEmailProfiles.length} profiles with missing emails`);
      fixes.push(() => fixMissingEmails(missingEmailProfiles));
    } else {
      console.log('✅ All profiles have email addresses');
    }

    // Check 3: Look for profiles with invalid timestamps
    console.log('\n⏰ Check 3: Invalid timestamps...');
    const { data: invalidTimestamps, error: timestampError } = await supabase
      .from('profiles')
      .select('id, created_at, updated_at')
      .or('created_at.is.null,updated_at.is.null');

    if (timestampError) {
      console.log('⚠️  Could not check timestamps:', timestampError.message);
    } else if (invalidTimestamps && invalidTimestamps.length > 0) {
      issues.push({
        severity: 'medium',
        issue: `${invalidTimestamps.length} profiles have invalid timestamps`,
        details: invalidTimestamps.map(p => `ID: ${p.id}`).join(', '),
        fix: 'Set created_at and updated_at to current timestamp'
      });
      console.log(`⚠️  Found ${invalidTimestamps.length} profiles with invalid timestamps`);
      fixes.push(() => fixInvalidTimestamps(invalidTimestamps));
    } else {
      console.log('✅ All profiles have valid timestamps');
    }

    // Check 4: Look for duplicate email addresses
    console.log('\n👥 Check 4: Duplicate email addresses...');
    const { data: duplicateEmails, error: duplicateError } = await supabase
      .rpc('find_duplicate_emails');

    if (duplicateError) {
      console.log('⚠️  Could not check for duplicates (function may not exist):', duplicateError.message);
      
      // Manual duplicate check
      const { data: allProfiles, error: allError } = await supabase
        .from('profiles')
        .select('id, email')
        .not('email', 'is', null);

      if (!allError && allProfiles) {
        const emailCounts = {};
        allProfiles.forEach(profile => {
          if (profile.email) {
            emailCounts[profile.email] = (emailCounts[profile.email] || 0) + 1;
          }
        });

        const duplicates = Object.entries(emailCounts)
          .filter(([email, count]) => count > 1)
          .map(([email, count]) => ({ email, count }));

        if (duplicates.length > 0) {
          issues.push({
            severity: 'high',
            issue: `${duplicates.length} duplicate email addresses found`,
            details: duplicates.map(d => `${d.email} (${d.count} times)`).join(', '),
            fix: 'Remove or merge duplicate profiles'
          });
          console.log(`⚠️  Found ${duplicates.length} duplicate email addresses`);
        } else {
          console.log('✅ No duplicate email addresses found');
        }
      }
    } else if (duplicateEmails && duplicateEmails.length > 0) {
      issues.push({
        severity: 'high',
        issue: `${duplicateEmails.length} duplicate email addresses`,
        details: duplicateEmails.map(d => d.email).join(', '),
        fix: 'Remove or merge duplicate profiles'
      });
      console.log(`⚠️  Found ${duplicateEmails.length} duplicate emails`);
    } else {
      console.log('✅ No duplicate email addresses found');
    }

    // Check 5: Orphaned or inconsistent profile data
    console.log('\n🔗 Check 5: Profile data consistency...');
    const { data: profileStats, error: statsError } = await supabase
      .from('profiles')
      .select('id, email, created_at, updated_at');

    if (!statsError && profileStats) {
      let inconsistentProfiles = 0;
      const now = new Date();

      profileStats.forEach(profile => {
        if (profile.created_at && profile.updated_at) {
          const createdAt = new Date(profile.created_at);
          const updatedAt = new Date(profile.updated_at);

          if (updatedAt < createdAt) {
            inconsistentProfiles++;
          }
        }
      });

      if (inconsistentProfiles > 0) {
        issues.push({
          severity: 'medium',
          issue: `${inconsistentProfiles} profiles have updated_at before created_at`,
          details: 'Timestamp logic inconsistency detected',
          fix: 'Correct updated_at timestamps'
        });
        console.log(`⚠️  Found ${inconsistentProfiles} profiles with inconsistent timestamps`);
      } else {
        console.log('✅ Profile timestamps are consistent');
      }
    }

    return { issues, fixes };

  } catch (error) {
    console.error('💥 Unexpected error during profile check:', error);
    return { issues: [{ severity: 'critical', issue: 'Unexpected error', details: error.message }], fixes: [] };
  }
}

async function fixMissingEmails(profiles) {
  console.log('\n🔧 Fixing missing email addresses...');
  
  for (const profile of profiles) {
    const placeholderEmail = `user-${profile.id}@placeholder.local`;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        email: placeholderEmail,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.log(`❌ Failed to fix profile ${profile.id}:`, updateError.message);
    } else {
      console.log(`✅ Fixed profile ${profile.id}: set email to ${placeholderEmail}`);
    }
  }
}

async function fixInvalidTimestamps(profiles) {
  console.log('\n🔧 Fixing invalid timestamps...');
  
  const now = new Date().toISOString();

  for (const profile of profiles) {
    const updates = {};
    
    if (!profile.created_at) {
      updates.created_at = now;
    }
    
    if (!profile.updated_at) {
      updates.updated_at = now;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (updateError) {
        console.log(`❌ Failed to fix timestamps for profile ${profile.id}:`, updateError.message);
      } else {
        console.log(`✅ Fixed timestamps for profile ${profile.id}`);
      }
    }
  }
}

async function generateReport(issues, fixes) {
  console.log('\n📊 PROFILE HEALTH REPORT');
  console.log('=======================');

  if (issues.length === 0) {
    console.log('🎉 No issues found! Your profiles table is healthy.');
    return;
  }

  console.log(`\n📋 Found ${issues.length} issue(s):\n`);

  issues.forEach((issue, index) => {
    const severityIcon = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    console.log(`${severityIcon[issue.severity]} ${index + 1}. ${issue.issue}`);
    console.log(`   Details: ${issue.details}`);
    console.log(`   Suggested Fix: ${issue.fix}\n`);
  });

  if (fixes.length > 0) {
    console.log(`🔧 ${fixes.length} automated fix(es) available.`);
  }
}

async function main() {
  console.log('🔐 Using environment variables for Supabase connection');
  console.log(`📍 Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
  console.log(`🔑 API Key: ${supabaseAnonKey?.substring(0, 20)}...\n`);

  const { issues, fixes } = await checkProfilesTable();
  await generateReport(issues, fixes);

  // Ask user if they want to run automatic fixes
  if (fixes.length > 0) {
    console.log('\n❓ Would you like to run automated fixes?');
    console.log('   Run with --fix flag to apply fixes automatically');
    console.log('   Example: node scripts/check-and-fix-profiles.js --fix');
    
    const shouldFix = process.argv.includes('--fix');
    if (shouldFix) {
      console.log('\n🔧 Running automated fixes...');
      
      for (const fix of fixes) {
        try {
          await fix();
        } catch (error) {
          console.error('❌ Fix failed:', error.message);
        }
      }
      
      console.log('\n✅ Automated fixes completed. Re-run check to verify.');
    }
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  process.exit(criticalIssues.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkProfilesTable, fixMissingEmails, fixInvalidTimestamps };