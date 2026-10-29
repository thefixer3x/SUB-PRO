## Services / Data Layer / RLS Posture - SUB-PRO 

**Repository:** `seftechub-workspace/apps/SUB-PRO`
**Scope:** Client-side Supabase access patterns, RLS coverage, secrets handling, PII exposure, AI/prompt injection surface, and cross-tenant isolation
**Method:** Read-only static analysis of 31 source files + 6 migrations
**Date:** 2026-10-29

---

## 1. Critical Findings

### F1 — Splitwise API Key Exposed in Client Bundle (CWE-798)

**Severity:** Critical
**CVSS v3.1:** 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)

**Location:** `services/splitwise.ts:49-51`
```ts
this.config = {
  apiKey: process.env.SPLITWISE_API_KEY || '',
  baseUrl: 'https://secure.splitwise.com/api/v3.0',
};
```
**Root cause:** `SPLITWISE_API_KEY` is read in a service file that ships to the React Native / web bundle. `splitwise.ts` has no `"server-only"` guard and is imported by `sharedSubscriptions.ts`, which is used in the app UI. The Splitwise API v3.0 key is an OAuth bearer token — anyone who decompiles the JS bundle can steal it and act as the Splitwise app owner.

**Remediation:**
- Move all Splitwise calls to a server-side proxy route (`app/api/splitwise/*`).
- The client should never import a file that reads a non-public env var.
- If the key is already in production, rotate it immediately.

**OWASP mapping:** A02:2021 — Cryptographic Failures (credentials in transit/at rest), MASVS-StORAGE CAP-8

---

### F2 — `database.ts` Instantiated with `service_role` Key in a Browser-Bundled File

**Severity:** Critical (Needs Verification — depends on whether `database.ts` is actually imported at runtime on the client)

**CVSS v3.1:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H)

**Location:** `services/database.ts:12-19`
```ts
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// ...
this.supabase = createClient<Database, 'public'>(supabaseUrl, serviceRoleKey, { ... });
```
**Root cause:** `supabase.ts:77` generates TypeScript types but is never imported by `database.ts` — that file imports `Database` from `'../lib/supabase'` instead (line 2). If `database.ts` is ever bundled into the client (it's in the `services/` directory with no build-time separation), a client would receive the service role key, completely bypassing RLS.

**Verification:** Run `npx depcheck` or `grep -r "from.*services/database"` to confirm it's only consumed by server-side API routes. Based on the search results, it is used by `netlify/functions/stripe-webhook.ts` and `app/api/stripe/webhook+api.ts` — both server-side. **However**, there is no compile-time or build-time enforcement. Any developer could inadvertently import it.

**Remediation:**
- Add `"server-only"` polyfill import at the top of `database.ts` so a bundler error fires if it's included in a client bundle.
- Or move `database.ts` outside the app root (e.g. under a `server/` or `functions/` directory).

**OWASP mapping:** A01:2021 — Broken Access Control, MASVS-PLATFORM CAP-6

---

### F3 — `supabase.ts` Key-Selection Logic Has a Silent-Failure Path

**Severity:** High
**CVSS v3.1:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)

**Location:** `lib/supabase.ts:8, 24-30`
```ts
const supabaseAnonKey = envAnonKey.length > 150 ? envAnonKey : '***REMOVED-SUPABASE-CREDENTIAL***';
// ...
const effectiveSupabaseAnonKey = isSupabaseEnvConfigured
  ? supabaseAnonKey
  : FALLBACK_SUPABASE_ANON_KEY; // = 'public-anon-key-placeholder'
```
**Root cause:** Supabase anon keys are typically ~200+ characters. If a key is present but shorter than 150 chars (e.g. misconfiguration, or a truncated key from a CI pipeline), `envAnonKey.length > 150` is `false`, so `supabaseAnonKey` is set to the redacted placeholder string `'***REMOVED-SUPABASE-CREDENTIAL***'`. Then `missingEnv` checks `!supabaseAnonKey` — since the string is non-empty, it is truthy, so `isSupabaseEnvConfigured` becomes `true`. The app creates a Supabase client with a fake key, which then returns `401` to every query. This silently breaks the app rather than displaying a user-facing error, but the real concern is: if the fallback key `'public-anon-key-placeholder'` is accidentally used as a real Supabase anon key in a test/staging project, it could grant anonymous read access to that project's public tables.

**Verification:** In any Supabase project, create a test project, use `'public-anon-key-placeholder'` as the anon key, and verify it fails 401. It does fail. However, the `***REMOVED***` path is the actual concern: the code *thinks* Supabase is configured, but queries will fail with a generic error message.

**Remediation:**
```ts
const isRealKey = envAnonKey.length > 10; // More reliable heuristic
// OR better: just check truthiness
const isSupabaseEnvConfigured = !!(supabaseUrl && envAnonKey);
```
**OWASP mapping:** A05:2021 — Security Misconfiguration

---

## 2. High Findings

### F4 — `securityMonitoring.ts` Sends HIBP API Key in Clear-Text HTTP Header

**Severity:** High
**CVSS v3.1:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)

**Location:** `services/securityMonitoring.ts:100-104`
```ts
const response = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${email}`, {
  headers: {
    'hibp-api-key': this.config.haveIBeenPwnedApiKey, // env var read at import time
    'User-Agent': 'SubscriptionManager-SecurityCheck',
  },
});
```
**Root cause:** `COMPLIANCE_CONFIG` reads `process.env.HAVEIBEENPWNED_API_KEY` at module-load time (`config/compliance.ts:8`). This file is imported by `securityMonitoring.ts`, which is a client-side service. The HIBP API key is therefore included in the client bundle. While HIBP keys have rate limits, they are still a credential that should not ship to the browser.

**Remediation:** Route breach checks through a server-side endpoint (`app/api/security/hibp-check`) that holds the key server-side. The client sends only the email hash.

**OWASP mapping:** A02:2021 — Cryptographic Failures, A04:2021 — Insecure Communications

---

### F5 — No RLS Policy on `card_authorizations` for INSERT — Relying on `USING (true)`

**Severity:** High
**CVSS v3.1:** 7.3 (AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:H/A:N)

**Location:** `supabase/migrations/20250902_complete_schema.sql:107-117`
```sql
CREATE POLICY "Users can view own card authorizations" ON card_authorizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM virtual_cards 
      WHERE virtual_cards.stripe_card_id = card_authorizations.stripe_card_id 
      AND virtual_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to card authorizations" ON card_authorizations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```
**Root cause:** The RLS policy on `card_authorizations` only covers `FOR SELECT` and `FOR ALL TO service_role`. There is **no policy for `FOR INSERT` or `FOR UPDATE` on authenticated users**. The `storeCardAuthorization` method in `database.ts:148-159` uses the service role key, so it works server-side. But if any client code ever attempts to insert a `card_authorization` row (or if a future developer adds an INSERT policy with `USING (true)`), there is no row-level scoping — any authenticated user could inject authorizations for other users' cards.

**Remediation:** Add an INSERT policy scoped to the card owner:
```sql
CREATE POLICY "Users can insert card authorizations for their own cards"
  ON card_authorizations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM virtual_cards 
      WHERE virtual_cards.stripe_card_id = NEW.stripe_card_id 
      AND virtual_cards.user_id = auth.uid()
    )
  );
```
**OWASP mapping:** A01:2021 — Broken Access Control

---

### F6 — `cancellationBot.ts` Accepts User Credentials (Email/Password) in Request Body

**Severity:** High
**CVSS v3.1:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)

**Location:** `services/cancellationBot.ts:4-12`
```ts
export interface CancellationParams {
  subscriptionId: string;
  userId: string;
  vendorUrl: string;
  userCredentials?: {
    email: string;
    password: string;
  };
}
```
**Root cause:** The `CancellationBotService.requestCancellation()` method accepts plaintext credentials for third-party vendor logins. These are serialized to JSON and sent over HTTPS to `/api/embedded-finance/cancellation/request`. However:
1. There is no evidence of encryption at rest for `userCredentials` in the database.
2. The `userId` parameter is sent client-side and trusted (see F7 below).
3. The vendor password is stored in plaintext in the app database, which is a credential management anti-pattern.

**Remediation:** Use OAuth/delegation flows instead of storing vendor passwords. If plaintext storage is unavoidable, encrypt at rest with per-user keys derived from Supabase auth JWT claims.

**OWASP mapping:** A02:2021 — Cryptographic Failures, A07:2021 — Identification and Authentication Failures

---

### F7 — Client-Side `updateSubscription` Has No Ownership Verification on `subscriptionId`

**Severity:** High
**CVSS v3.1:** 6.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)

**Location:** `services/subscriptionService.ts:134-151`
```ts
const { data, error } = await (
  supabase.from(SUBSCRIPTIONS_TABLE) as unknown as { ... }
)
  .update(dbUpdates)
  .eq('id', subscriptionId)
  .select()
  .single();
```
**Root cause:** `updateSubscription()` takes a `subscriptionId` and an arbitrary `Partial<Subscription>` update object. The RLS policy `CREATE POLICY "Users can manage own subscriptions" ON subscriptions FOR ALL USING (auth.uid() = user_id)` relies on the server to match `auth.uid()` against the `user_id` column. Supabase RLS applies the `USING` clause as a filter, not a `WHERE` clause — meaning the `eq('id', subscriptionId)` happens *before* RLS filtering. An attacker who knows any subscription ID can attempt to update its `status`, `plan_name`, `monthly_cost`, or other fields. If RLS is correctly scoped, the update only takes effect if the row's `user_id` matches — but there is no explicit `WITH CHECK` clause on the policy to validate the update payload.

**Verification:** Run `supabase db remote diff` or query `pg_policies` on the running database to confirm the exact policy text.

**Remediation:** Add `WITH CHECK` to the RLS policy:
```sql
CREATE POLICY "Users can manage own subscriptions" ON subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
Also consider adding an `adminOnly` flag to `updateSubscription()` to reject `user_id` or `subscription_tier` changes from the client.

**OWASP mapping:** A01:2021 — Broken Access Control

---

## 3. Medium Findings

### F8 — `auth.jwt()->>'role' = 'service_role'` Is Not a Valid Supabase RLS Check

**Severity:** Medium
**CVSS v3.1:** 5.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)

**Location:** `supabase/migrations/20250902_complete_schema.sql:31, 64, 87, 117, 140, 160`

Multiple policies use:
```sql
FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```
**Root cause:** In Supabase, when using the anon key, `auth.jwt()->>'role'` returns `'authenticated'`. The service role bypasses RLS entirely because the Supabase runtime injects `auth.role() = 'service_role'`. Checking `auth.jwt()->>'role' = 'service_role'` in an RLS policy is ineffective — the anon-key JWT never has a `role` claim set to `service_role`. This means the "service role full access" policy will **never match** for a real service-role connection. The Supabase service role uses the Supabase client library's special behavior, not a JWT claim.

As a result, policies like `"Service role has full access to profiles"` are dead code. If the Supabase client in `database.ts` uses the service role key, it will bypass RLS regardless. If a misconfigured client somehow sends a JWT with `role: service_role`, it would bypass RLS — but that's an attacker issue, not a Supabase configuration issue.

The actual correct pattern is:
```sql
-- Only needed if using a custom JWT middleware
USING (auth.jwt()->>'role' = 'service_role')
```
But in standard Supabase, the service role key bypasses RLS entirely.

**Remediation:** Remove the dead "service role" policies or replace with:
```sql
FOR ALL TO authenticated USING (auth.uid() = id);
-- No service_role policy needed; service role bypasses RLS by design.
```
**OWASP mapping:** A01:2021 — Broken Access Control

---

### F9 — `sm_feature_flags` Table Has PUBLIC SELECT on All Rows

**Severity:** Medium
**CVSS v3.1:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)

**Location:** `supabase/migrations/20250902_complete_schema.sql:156-157`
```sql
CREATE POLICY "Allow public read access to feature flags" ON sm_feature_flags
  FOR SELECT USING (true);
```
**Root cause:** Any anonymous user (no auth required) can read the entire `sm_feature_flags` table. While feature flags are typically low-severity, this could expose beta/hidden feature configuration to attackers. The `feature_flags` table from the earlier migration (`20250630053126_billowing_valley.sql:47-49`) has the same pattern.

**Remediation:** Restrict to `authenticated` role only:
```sql
CREATE POLICY "Allow authenticated read to feature flags" ON sm_feature_flags
  FOR SELECT TO authenticated USING (true);
```
**OWASP mapping:** A01:2021 — Broken Access Control

---

### F10 — `notificationScheduler.ts` Schedules Client-Side Notifications Without Server Verification

**Severity:** Medium
**CVSS v3.1:** 5.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)

**Location:** `services/notificationScheduler.ts:36-77`
```ts
export async function scheduleRenewalReminders(
  subscriptions: Subscription[],
  daysBefore: number = 3,
): Promise<number> {
```
**Root cause:** `scheduleRenewalReminders` receives raw subscription data from the client and schedules local notifications using `expo-notifications`. This is a client-side scheduled notification (device-level), not a server-push notification. Key concerns:
1. If the device is off or the app is killed, notifications are lost (reliability, not security).
2. The subscriptions array is client-fetched; RLS protects the data but the *schedule* is entirely client-controlled.
3. Notification tokens are not stored or managed — this is local scheduling, so there's no token in the database.

The concern is primarily reliability/UX rather than a direct security vulnerability. However, an attacker who can modify the subscription data (see F7) could schedule notifications at arbitrary times.

**Remediation:** Move renewal reminder scheduling to a server-side cron (e.g. Vercel cron, Supabase Edge Functions) that uses the server Supabase client and sends push notifications via Expo Push API.

**OWASP mapping:** A04:2021 — Insecure Communication (push channels), MASVS-PLATFORM CAP-5

---

### F11 — PII Logged in `console.log` Statements

**Severity:** Medium
**CVSS v3.1:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)

**Locations:**
- `services/database.ts:36, 57, 61, 74, 78, 98, 121, 128, 144, 162, 169, 185, 191, 207, 221, 225, 228`
- `services/securityMonitoring.ts:60, 88, 131, 171, 198, 237, 276`
- `services/stripe.ts:141-143, 146-148, 151-153, 156-158, 161-163, 167-170, 178-180, 189-191, 199-201, 208-210`

**Examples:**
```ts
// database.ts:36
console.log('Updating user subscription tier:', { userId, stripeSubscriptionId, status, planName });

// stripe.ts:167-170
console.log('Card authorization created:', authorization.id);
console.log('Amount:', authorization.amount / 100, authorization.currency.toUpperCase());
console.log('Merchant:', authorization.merchant_data?.name);
console.log('Card:', authorization.card?.last4);
```
**Root cause:** Financial data (Stripe amounts, card last-4 digits, user IDs), subscription details, and audit events are written to `console.log`. In production (web builds), `webpack.config.js:59-62` drops `console.log` via Terser, but **EAS mobile builds do not strip `console.log` by default**. On mobile, these logs may be accessible via device logcat/Xcode console.

**Remediation:**
- Use a structured logging library (e.g. `pino`, `winston`) with configurable log levels.
- Ensure production builds set `NODE_ENV=production` and have Terser configured for both web and EAS (via `expo-build-properties` or Metro transform).
- Never log `last4`, full card numbers, or PII.

**OWASP mapping:** A09:2021 — Security Logging and Monitoring Failures, MASVS-CODE CAP-1

---

### F12 — `bank_accounts` Table Stores `account_number` in Plaintext Without Encryption

**Severity:** Medium
**CVSS v3.1:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N)

**Location:** `supabase/migrations/20260321_bank_accounts_and_detection_followups.sql:23-35`
```sql
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT,  -- ← plaintext bank account number
  ...
```
**Root cause:** Bank account numbers are stored in plaintext in the `bank_accounts` table. While RLS protects access to the row, a compromised service role key or a misconfigured policy could expose all users' bank details. PCI-DSS and banking regulations typically require encryption at rest for account numbers.

**Remediation:** Encrypt `account_number` at the application level using Supabase `pgcrypto` or an application-layer envelope encryption scheme. Mask the number in all UIs.

**OWASP mapping:** A02:2021 — Cryptographic Failures, MASVS-STORAGE CAP-2

---

## 4. Low Findings

### F13 — `communityStats.ts` Sends Subscription Data to Community API Without Consent Gate

**Severity:** Low
**CVSS v3.1:** 3.7 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Location:** `services/communityStats.ts:86-105`
```ts
async contributeToCommunityStats(subscriptions: Subscription[]): Promise<void> {
  const anonymizedData = subscriptions.map(sub => ({
    serviceName: sub.name,
    category: sub.category,
    monthlyCost: sub.monthlyCost,
    planName: sub.planName,
    billingCycle: sub.billingCycle,
  }));
  await fetch('/api/social/contribute-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: anonymizedData }),
  });
}
```
**Root cause:** While the data is "anonymized" (no `userId`), it still sends the user's full subscription portfolio (names, costs, plan types) to a server that could potentially re-identify the user via the combination of data points. The user must opt-in via `updateUserDataSharing`, but there is no evidence in this file that `contributeToCommunityStats` checks the consent state before sending.

**Remediation:** Add an explicit consent check:
```ts
const sharing = await getUserDataSharing(userId);
if (!sharing?.enabled) return;
```
**OWASP mapping:** A01:2021 — Broken Access Control, GDPR Article 6 (lawful basis for processing)

---

### F14 — `useSubscriptions.ts` Hook Returns Mock Data, Not Live Data

**Severity:** Low
**CVSS v3.1:** 3.7 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Location:** `hooks/useSubscriptions.ts:6-9`
```ts
const fetchSubscriptions = async (): Promise<Subscription[]> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return mockSubscriptions;  // ← returns mock data, not from Supabase
};
```
**Root cause:** The `useSubscriptions` hook returns mock data indefinitely, never querying Supabase. This is likely a development placeholder that shipped to production. The `subscriptionService.ts` has real `fetchUserSubscriptions`, `createSubscription`, etc., but this hook bypasses them entirely.

**Remediation:** Replace with `fetchUserSubscriptions(userId)` from `subscriptionService.ts`.

**OWASP mapping:** A05:2021 — Security Misconfiguration (dead code / inconsistent data paths)

---

### F15 — `embeddedCredit.ts` Is Entirely Mock/Stub Implementation

**Severity:** Low
**CVSS v3.1:** 3.1 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Location:** `services/embeddedCredit.ts` (all 220 lines)

**Root cause:** Every method in `EmbeddedCreditService` is a TODO stub returning hardcoded mock data. `getCreditAccount()` returns a fake account with `creditLimit: 5000`, `checkEligibility()` always returns `{ eligible: true }`, and `processSubscriptionPayment()` never actually processes anything. While not a security vulnerability per se, this creates a false sense of functionality and could lead to users believing payments are being processed when they are not.

**Remediation:** Either implement the actual credit check/payment logic or gate the feature behind a feature flag and display an appropriate "coming soon" message.

---

### F16 — `sm_update_feature_flag` and `handle_new_user` Are `SECURITY DEFINER` Without `SET search_path`

**Severity:** Low (potential for privilege escalation in specific attack scenarios)
**CVSS v3.1:** 5.3 (AV:N/AC:H/PR:N/UI:N/S:C/C:N/I:L/A:N)

**Location:** 
- `supabase/migrations/20250902_complete_schema.sql:165-171`
- `supabase/migrations/20250902_complete_schema.sql:174-189`
- `supabase/migrations/20250902_complete_schema.sql:229-236`
- `supabase/migrations/20250630053126_billowing_valley.sql:52-61`

```sql
CREATE OR REPLACE FUNCTION update_feature_flag(flag_name TEXT, flag_enabled BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.feature_flags SET enabled = flag_enabled ...
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- NOTE: No SET search_path = ... here!
```
**Root cause:** `SECURITY DEFINER` functions run with the privileges of the function owner (typically the user who created the function, which in Supabase is the service role user). Without `SET search_path = public`, an attacker who can create tables or functions in a writable schema (e.g. if `CREATE` is granted on `public` to `authenticated`) could create a malicious function with the same name and have the SECURITY DEFINER function execute it.

The 20250701 hardening migration (`20250701_security_and_perf_hardening.sql:137-161`) pins `search_path` on *some* functions but not on `update_feature_flag`, `sm_update_feature_flag`, `handle_new_user`, or `create_virtual_cards_table_if_not_exists`.

**Remediation:** Add `SET search_path = pg_catalog, public` to all SECURITY DEFINER functions:
```sql
CREATE OR REPLACE FUNCTION update_feature_flag(flag_name TEXT, flag_enabled BOOLEAN)
RETURNS BOOLEAN AS $$
  BEGIN
    UPDATE public.feature_flags SET enabled = flag_enabled, updated_at = now()
    WHERE name = flag_name;
    RETURN FOUND;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
```
**OWASP mapping:** A01:2021 — Broken Access Control, CWE-269 (Improper Privilege Management)

---

## 5. Informational / Positive Security Controls Observed

1. **RLS is enabled on all core tables** (`profiles`, `subscriptions`, `virtual_cards`, `payment_records`, `bank_accounts`, `sm_feature_flags`, `card_authorizations`) — confirmed in migrations. ✅
2. **Service role key is only used in `database.ts`**, which is consumed by server-side API routes (`stripe-webhook.ts`), not client code. The key is not prefixed with `EXPO_PUBLIC_`. ✅
3. **Stripe secret key is confined to `stripe-server.ts`**, which is only imported by API routes (`app/api/stripe/webhook+api.ts`, `netlify/functions/stripe-webhook.ts`). ✅
4. **Banking proxy (`app/api/banking/proxy+api.ts`, `netlify/functions/banking-proxy.ts`)** correctly validates Supabase JWT before forwarding requests to the MCP upstream, and the MCP bearer token (`MCP_API_KEY`) never reaches the client bundle. ✅
5. **`AuthContext.tsx`** properly gates Supabase auth behind `isSupabaseEnvConfigured` and has demo-mode disabled by default (`DEMO_MODE_ENABLED = false`). ✅
6. **`subscriptionService.ts`** explicitly scopes queries to `user_id` with `.eq('user_id', userId)`. ✅
7. **Migrations are replay-safe** — all DDL is wrapped in `IF NOT EXISTS` / `IF to_regclass(...) IS NOT NULL` checks, preventing failures on fresh Supabase project resets. ✅

---

## 6. Remediation Priority Matrix

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| P0 | F1 — Rotate Splitwise API key + move to server | 2h | Critical credential exposure |
| P0 | F2 — Add `server-only` guard to `database.ts` | 15m | Prevents accidental service_role leak |
| P1 | F4 — Move HIBP check to server proxy | 1h | Credential exposure in client bundle |
| P1 | F6 — Remove plaintext vendor password storage | 4h | Credential management anti-pattern |
| P1 | F7 — Add `WITH CHECK` to subscriptions RLS policy | 30m | Prevents cross-user subscription edits |
| P1 | F12 — Encrypt `bank_accounts.account_number` at rest | 4h | Regulatory compliance (PCI/ bank data) |
| P2 | F3 — Fix key-selection heuristic | 15m | Prevents silent auth failure |
| P2 | F8 — Remove dead service_role RLS policies | 1h | Removes false sense of security |
| P2 | F9 — Restrict feature flags to authenticated | 15m | Information disclosure |
| P2 | F11 — Configure production log stripping for EAS | 1h | PII in mobile logs |
| P2 | F16 — Pin `search_path` on SECURITY DEFINER functions | 2h | Defense-in-depth for privilege escalation |
| P3 | F5 — Add INSERT policy on `card_authorizations` | 30m | Future-proof RLS coverage |
| P3 | F10 — Move notification scheduling to server | 4h | Reliability, minor security |
| P3 | F13 — Add consent check before community stats | 30m | GDPR compliance |
| P3 | F14 — Replace mock data hook with real Supabase query | 30m | Data inconsistency |
| P3 | F15 — Implement or disable stub credit service | 8h | False functionality |
---

## 7. Artifacts Reviewed

### Source Files (28)
| # | File | Lines |
|---|------|-------|
| 1 | `lib/supabase.ts` | 420 |
| 2 | `services/database.ts` | 236 |
| 3 | `services/subscriptionService.ts` | 176 |
| 4 | `services/aiAssistant.ts` | 445 |
| 5 | `services/notificationScheduler.ts` | 85 |
| 6 | `services/cancellationBot.ts` | 115 |
| 7 | `services/splitwise.ts` | 187 |
| 8 | `services/mcpBankingService.ts` | 512 |
| 9 | `services/auditLogging.ts` | 155 |
| 10 | `services/gdprCompliance.ts` | 170 |
| 11 | `services/securityMonitoring.ts` | 304 |
| 12 | `services/virtualCards.ts` | 173 |
| 13 | `services/embeddedCredit.ts` | 220 |
| 14 | `services/affiliateSystem.ts` | 170 |
| 15 | `services/partnerTracking.ts` | 74 |
| 16 | `services/sharedSubscriptions.ts` | 281 |
| 17 | `services/communityStats.ts` | 172 |
| 18 | `services/stripe.ts` | 221 |
| 19 | `services/stripe-server.ts` | 11 |
| 20 | `data/mockData.ts` | 146 |
| 21 | `data/partners.ts` | 52 |
| 22 | `data/chartData.ts` | 157 |
| 23 | `contexts/AuthContext.tsx` | 433 |
| 24 | `contexts/FeatureFlagsContext.tsx` | 55 |
| 25 | `contexts/ThemeContext.tsx` | 120 |
| 26 | `hooks/usePayments.ts` | 149 |
| 27 | `hooks/useSubscriptions.ts` | 28 |
| 28 | `hooks/useSubscription.tsx` | 132 |
| 29 | `hooks/useFeatureFlags.ts` | 74 |
### Config & Support Files (4)
| # | File | Lines |
|---|------|-------|
| 30 | `config/compliance.ts` | 46 |
| 31 | `config/stripe.ts` | 56 |
| 32 | `utils/subscriptionValidator.ts` | 234 |
| 33 | `lib/apiClient.ts` | 148 |
### Server-Side Proxy Files (3)
| # | File | Lines |
|---|------|-------|
| 34 | `app/api/banking/proxy+api.ts` | 134 |
| 35 | `netlify/functions/banking-proxy.ts` | 146 |
| 36 | `types/compliance.ts` | 80 |
### Build Configuration (3)
| # | File | Lines |
|---|------|-------|
| 37 | `webpack.config.js` | 117 |
| 38 | `babel.config.js` | 15 |
| 39 | `.env.example` | 30 |
### Supabase Migrations (6)
| # | File | Lines |
|---|------|-------|
| 40 | `supabase/migrations/20250630053126_billowing_valley.sql` | 64 |
| 41 | `supabase/migrations/20250701_rls_policy_wrappers.sql` | 123 |
| 42 | `supabase/migrations/20250701_security_and_perf_hardening.sql` | 261 |
| 43 | `supabase/migrations/20250702_api_marketplace_usage_policy_wrapper.sql` | 26 |
| 44 | `supabase/migrations/20250902_complete_schema.sql` | 259 |
| 45 | `supabase/migrations/20260320_detected_subscription_identity.sql` | 20 |
| 46 | `supabase/migrations/20260321_bank_accounts_and_detection_followups.sql` | 88 |
### Files Not Fully Read (mentioned but out of scope or already covered)
- `types/aiAssistant.ts` — type definitions only
- `types/embeddedFinance.ts` — type definitions only
- `types/monetization.ts` — type definitions only
- `types/partner.ts` — type definitions only
- `types/social.ts` — type definitions only
- `types/subscription.ts` — type definitions only
- `types/embeddedCredit.ts` — type definitions only
- `app/api/stripe/webhook+api.ts` — server-side only, not in assigned scope
- `netlify/functions/stripe-webhook.ts` — server-side only, not in assigned scope
- `.bolt/supabase_discarded_migrations/*` — discarded, not applied

---

**End of Report.**
