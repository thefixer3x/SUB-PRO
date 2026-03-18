# SUB-PRO: DB Alignment & Phased Fix Plan
## DB Alignment Report (Live vs Local Migrations)
**Supabase Instance:** `mxtsdgkwzjzlttpotole` (SHARED with MCP/memory/agent systems — 80 tables)
**SUB-PRO project ref in .env.local:** `hjplkyeuycajchayuylw` (different instance — currently unreachable via MCP)
### Table-by-Table Status
**profiles** — EXISTS, PARTIAL MATCH
* Live: 12 columns (id, first_name, last_name, company_name, business_type, is_vendor, created_at, updated_at, email, full_name, subscription_tier, stripe_customer_id)
* Migration expects: 7 columns (id, email, full_name, subscription_tier, stripe_customer_id, created_at, updated_at)
* Verdict: Live is a SUPERSET. All migration columns present. Extra cols from shared services. `handle_new_user` trigger exists BUT only inserts `id` (not email/full_name as migration expects).
* RLS: Enabled. 3 policies (insert/select/update). Missing: service_role full-access policy.
**subscriptions** — MISSING (CRITICAL)
* The core table for the entire app does not exist in the live DB.
* Client code (`useSubscriptions.ts`) returns `mockSubscriptions` hardcoded data because of this.
**virtual_cards** — EXISTS, SCHEMA MISMATCH
* Live: id, user_id, cardholder_id, card_id, last4, status, is_locked, created_at, updated_at
* Migration expects: id, user_id, stripe_card_id, last4, brand, status, subscription_id, created_at, updated_at
* Missing in live: `brand`, `subscription_id` (FK to subscriptions)
* Different naming: `card_id` vs `stripe_card_id`, extra `cardholder_id`, `is_locked`
* RLS: Enabled but only SELECT policy. Migration expects ALL policy.
**card_authorizations** — MISSING
* Needed for spending tracking per virtual card.
**payment_records** — MISSING
* Needed for payment history tracking.
**sm_feature_flags** — MISSING
* The `feature_flags` table EXISTS but with different schema (has rollout_percentage, user_groups cols; uses bigint PK not UUID).
* The existing `feature_flags` table has 0 rows — no flags seeded.
* Client code (`config/featureFlags.ts`) uses hardcoded flags, never queries DB.
**Functions:**
* `update_updated_at_column` — EXISTS (4 instances)
* `handle_new_user` — EXISTS but simplified (only inserts id, not email/full_name)
* `sm_update_feature_flag` — MISSING
* `create_virtual_cards_table_if_not_exists` — MISSING
**Other migrations (20250701, 20250702):** These target MCP/memory system tables (api_marketplace, autonomous_agent_runs, etc.) — NOT SUB-PRO specific. Irrelevant to this fix.
## Phase 1: Foundation — DB Schema Alignment (Day 1)
**Goal:** Get the live DB matching what the app expects.
### 1.1 Create `subscriptions` table
Apply the CREATE TABLE from `20250902_complete_schema.sql` lines 34-64. Add RLS + policies + updated_at trigger.
### 1.2 Create `card_authorizations` table
Apply lines 90-117 from same migration.
### 1.3 Create `payment_records` table
Apply lines 120-140 from same migration.
### 1.4 Create `sm_feature_flags` table + seed data
Apply from `supabase_migration_sm_feature_flags.sql`. Seed all 12 flags. Keep existing `feature_flags` table untouched (used by other services).
### 1.5 Fix `handle_new_user` trigger
Update function to insert `email` and `full_name` from `raw_user_meta_data`, matching migration lines 229-243.
### 1.6 Align `virtual_cards` schema
ADD COLUMN `brand TEXT`, ADD COLUMN `subscription_id UUID REFERENCES subscriptions(id)`. Leave existing columns (cardholder_id, card_id, is_locked) for backward compat with other services. Add missing RLS ALL policy.
### 1.7 Add missing RLS policies on `profiles`
Add service_role full-access policy.
## Phase 2: Wire Subscriptions to Supabase (Day 2-3)
**Goal:** Replace mock data with live Supabase queries.
### 2.1 Create `services/subscriptionService.ts`
CRUD operations against the `subscriptions` table using the existing Supabase client. Functions: `fetchUserSubscriptions`, `createSubscription`, `updateSubscription`, `deleteSubscription`.
### 2.2 Rewrite `hooks/useSubscriptions.ts`
Replace `mockSubscriptions` import with Supabase query via `subscriptionService`. Keep react-query wrapper for caching. Add optimistic updates for mutations.
### 2.3 Wire dashboard metrics
Replace hardcoded metrics (12 subs, $247.89) with computed values from real subscription data.
### 2.4 Add subscription CRUD UI
Wire the existing add/edit/delete flows to the real service layer.
## Phase 3: Feature Flags from DB (Day 3-4)
**Goal:** Feature flags driven by `sm_feature_flags` table.
### 3.1 Create `hooks/useFeatureFlags.ts`
Query `sm_feature_flags` table via Supabase. Fall back to `config/featureFlags.ts` hardcoded values if query fails. Cache with react-query.
### 3.2 Update `config/featureFlags.ts`
Make it a fallback-only module. Primary source becomes DB.
### 3.3 Turn ON flags for existing features
Enable in DB: GDPR_TOOLS, COMPLIANCE_CENTER, COMMUNITY_STATS, BULK_UPLOAD, SECURITY_MONITORING — code already exists for all of these, just flagged OFF.
## Phase 4: Stripe Payment Flow (Day 4-5)
**Goal:** Working Free → Pro upgrade via Stripe Checkout.
### 4.1 Validate env vars
Ensure `STRIPE_SECRET_KEY` and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set.
### 4.2 Fix checkout session API
`create-checkout-session+api.ts` expects `priceId` and `customerId` but `usePayments.ts` sends `plan` and `userId`. Align the request/response contract.
### 4.3 Implement webhook handler
Stripe webhook → update `profiles.subscription_tier` and insert into `payment_records`. The route at `app/api/stripe/webhook+api.ts` needs the handler logic.
### 4.4 Implement customer portal
Replace the TODO stub in `usePayments.ts:104` with real `stripe.billingPortal.sessions.create()` call via `create-portal-session+api.ts`.
### 4.5 Implement cancellation
Replace TODO stub in `usePayments.ts:129` with portal redirect or direct cancellation API.
## Phase 5: Charts & Data Visualization (Day 5-6)
**Goal:** Real charts with Recharts (already installed).
### 5.1 Wire chart components to real data
Replace placeholder text in `components/charts/` with actual `<LineChart>`, `<PieChart>` etc. from Recharts.
### 5.2 Connect to subscription data
Compute spending trends, category breakdown from live `subscriptions` + `payment_records` tables.
## Phase 6: Notifications & Polish (Day 6-7)
**Goal:** Push notification scheduling + UI polish.
### 6.1 Add notification scheduling
`expo-notifications` is installed. `useReminderSettings.ts` saves timing prefs. Add actual `Notifications.scheduleNotificationAsync()` for renewal reminders.
### 6.2 Surface hidden features
Ensure CancellationBot, GDPR Privacy Center, Security Dashboard are accessible via navigation (code exists, just not routed).
### 6.3 OpenRouter AI integration (stretch)
Only truly missing feature. Integrate OpenRouter API for real AI-powered spending insights to replace rule-based `aiAssistant.ts`.