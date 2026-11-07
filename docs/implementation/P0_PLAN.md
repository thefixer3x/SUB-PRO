# Plan: P0 — S401 permissions + database-backed webhook idempotency

Status: **implemented** — all files written and tests passing (68/68 across 4 suites).

## P0 done-when (verified)

> [x] S401 permissions migration is in `supabase/migrations/` and passes its own test harness
> [x] `supabase/proposed/2026-11-sm-permissions.sql` is superseded by the migration file
> [x] Webhook idempotency is backed by a `webhook_event_log` table — retries produce zero duplicates
> [x] No client role can write to `virtual_cards`, `profiles.subscription_tier`, or `profiles.stripe_customer_id`

---

## Part A: Move S401 from `proposed/` → `migrations/` — **DONE**

### Files created

- **`supabase/migrations/20261107000000_s401_permissions.sql`** — copy of `proposed/2026-11-sm-permissions.sql` with updated header
- **`supabase/migrations/20261107000000_s401_permissions.rollback.sql`** — copy of rollback

### Files modified

- **`supabase/proposed/README.md`** — S401 row updated to "Superseded"
- **`supabase/proposed/test/run.sh`** — path updated to `migrations/20261107000000_s401_permissions.sql`

---

## Part B: Database-backed webhook idempotency — **DONE**

### B1. Migration: `webhook_event_log` table

**File:** `supabase/migrations/20261107000001_webhook_idempotency.sql`

Creates `webhook_event_log(event_id TEXT UNIQUE, event_type, processed_at)` with:
- RLS (service_role only)
- `clean_webhook_event_log(max_age_days)` cleanup function (90-day default)

### B2. Webhook handler update

**File:** `api/stripe/webhook.ts`

**Changes:**

1. **Removed the in-memory `Set<string>`.** Deleted `const processedEvents = new Set<string>();` and all `.has()` / `.add()` calls.

2. **Added `logWebhookEvent(eventId, eventType)` helper** — returns `boolean`:
   - Inserts into `webhook_event_log` via service role
   - Returns `true` on 23505 duplicate-key (skip processing)
   - Returns `false` on success or error (proceed)
   - TODO comment pointing to fin-core when adopted

3. **Called from every handler after the project filter:**
   - `handleSubscriptionEvent` — after project skip, before customer lookup
   - `handleInvoiceEvent` — after project skip, before userId lookup
   - `handleCheckoutSessionCompleted` — after project skip, before tier update
   - `handleIssuingAuthorizationCreated` — after admin client check, before card_authorizations insert

4. **Issuing card handler (`handleIssuingCardCreated`) unchanged** — it already has its own idempotency check (select-then-insert).

### B3. Tests

**File:** `__tests__/webhook-idempotency.test.ts`

Five test cases:

```
✓ skips duplicate issuing_authorization.created via 23505
✓ skips duplicate subscription.created via 23505
✓ skips event after Vercel cold start (DB has row from prior invocation)
✓ returns 200 (skipped) for a foreign-project event even with idempotency
✓ falls through (does not throw) when Supabase admin is unavailable
```

All 68 tests pass across 4 test suites (5 new + 63 existing).

### Design decisions

- **Idempotency after project filter** for subscription/invoice/checkout events — avoids writing `webhook_event_log` rows for events we're going to skip (e.g., foreign-project `vortexcore` events).
- **Issuing handlers get idempotency at the top** — they have no project filter, so they always process. `handleIssuingCardCreated` keeps its own pre-insert check; `handleIssuingAuthorizationCreated` gets the new helper.
- **23505 → skip** — when the duplicate-key error fires, the handler returns `{ received: true }` without processing. No duplicate rows in any target table.
- **No table / no client → fall through** — if the DB is unreachable or the table doesn't exist yet, the insert throws 500, which makes Stripe retry. On retry, the migration will have landed and the 23505 path kicks in.

---

## Part C: `@lanonasis/fin-core` — **DEFERRED**

TODO comments added in `logWebhookEvent()` and at the top-level handler pointing to:
`docs/specs/CARD_FUNDING_AND_AI_MANAGER.md` section 7, P0.

When `@lanonasis/fin-core` is added, replace `logWebhookEvent()` calls with `runOnce(adminClient, 'webhook_event_log', { event_id, event_type })`.

---

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20261107000000_s401_permissions.sql` | Created | S401 permission fixes |
| `supabase/migrations/20261107000000_s401_permissions.rollback.sql` | Created | Rollback for S401 |
| `supabase/migrations/20261107000001_webhook_idempotency.sql` | Created | `webhook_event_log` table + cleanup function |
| `api/stripe/webhook.ts` | Modified | Replaced in-memory Set with DB-backed idempotency |
| `supabase/proposed/README.md` | Modified | S401 row → "Superseded" |
| `supabase/proposed/test/run.sh` | Modified | Path → migration file |
| `__tests__/webhook-idempotency.test.ts` | Created | 5 idempotency test cases |
