// Simple script to output the SQL commands needed to fix the profiles table
console.log(`
=== SQL Commands to Fix Profiles Table ===

Run these commands in your Supabase SQL Editor:

1. Add email column:
   ALTER TABLE profiles ADD COLUMN email TEXT UNIQUE;

2. Add full_name column:
   ALTER TABLE profiles ADD COLUMN full_name TEXT;

3. Add subscription_tier column:
   ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team'));

4. Add stripe_customer_id column:
   ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;

5. Refresh the schema cache (optional but recommended):
   SELECT pg_notify('pgrst', 'reload schema');

After running these commands:
1. Restart your development server
2. The sign-up and sign-in functionality should work correctly

=== End Instructions ===
`);