# Supabase publishable-key migration and sign-in recovery

## Context
- Production app: https://sub-pro.vercel.app/
- Supabase API vanity domain: https://lanonasis.supabase.co
- Confirmed vanity mapping: lanonasis.supabase.co -> mxtsdgkwzjzlttpotole.supabase.co
- Incident: browser request to /rest/v1/sm_feature_flags?select=name%2Cenabled returns "No API key found in request".

## Confirmed code findings
1. `lib/supabase.ts` previously read only `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. It rejected any key shorter than 151 characters. Modern Supabase publishable keys start with `sb_publishable_` and are much shorter, so the modern key was incorrectly discarded.
3. `webpack.config.js` only injected the legacy Expo anon-key variable into the browser bundle.
4. `app/api/feature-flags/index+api.ts` used the old public key variable for GET and an `EXPO_PUBLIC_*` service-role variable for POST. The latter is unsafe because Expo-public variables can be embedded in a client bundle.
5. The feature-flags hook calls `supabase.from('sm_feature_flags').select('name, enabled')` through the shared client.

## Intended fix
- Prefer `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with legacy anon variables retained temporarily for compatibility.
- Accept modern `sb_publishable_` keys as valid without applying the legacy JWT length check.
- Inject the publishable key into the web build from the available Vercel variable names.
- For server-side feature-flag writes, use `SUPABASE_SECRET_KEY` (or legacy server-only `SUPABASE_SERVICE_ROLE_KEY`) only. Never use `EXPO_PUBLIC_SUPABASE_SECRET_KEY` or `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Keep the configured vanity domain; do not rotate keys, change the domain, or disable RLS as part of this fix.

## Required validation before merge
1. Confirm Vercel Production and Preview have `EXPO_PUBLIC_SUPABASE_URL=https://lanonasis.supabase.co` and at least one active modern publishable-key variable. Redeploy after env changes; browser bundles are build-time artifacts.
2. Confirm the deployed bundle contains no secret/service-role key.
3. In DevTools Network, reload and inspect the failing request. It must include an `apikey` request header with a publishable key. Never paste the key into tickets/logs.
4. If the header is absent, inspect the request Initiator to determine whether the request comes from this shared Supabase client, another client, direct fetch, a service worker, or a stale deployment.
5. Test sign-in, sign-out, session persistence, refresh, and password reset. Then test feature-flag GET and protected feature-flag POST.
6. If the request now includes `apikey` but returns 401/403, investigate key validity, Auth configuration, RLS and grants separately; that is a different failure from the current missing-header response.
7. Do not merge until lint/typecheck/build pass and auth smoke tests pass.

## Security follow-up
- Audit the entire repo for `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_SUPABASE_SECRET_KEY`, hard-coded secrets, and all Supabase client constructors.
- Ensure feature-flag POST requires authenticated/authorized admin access; a server secret alone must not make an unauthenticated public endpoint writable.
- After the migration is confirmed, remove stale legacy variables only in a separate, verified cleanup change.
