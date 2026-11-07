# Plan: P0 — S401 permissions + database-backed webhook idempotency

Status: **draft** — not yet applied. All work is test-mode.

## P0 done-when

> [ ] S401 permissions migration is in `supabase/migrations/` and passes its own test harness
> [ ] `supabase/proposed/2026-11-sm-permissions.sql` is replaced by (or references) the migration file
> [ ] Webhook idempotency is backed by a `webhook_event_log` table — a retried `issuing_*` or `subscription.*` event produces zero duplicates in `virtual_cards`, `card_authorizations`, `sm_subscriptions`, or `payment_records`
> [ ] No client role can write to `virtual_cards`, `profiles.subscription_tier`, or `profiles.stripe_customer_id`

---

## Part A: Move S401 from `proposed/` → `migrations/`

### A1. Create the migration file

**File:** `supabase/migrations/20261107000000_s401_permissions.sql`

Copy the contents of `supabase/proposed/2026-11-sm-permissions.sql` verbatim.
No schema change is needed — the proposed file already describes the exact live
state it replaces and is idempotent (drops policies before re-creating).

### A2. Create rollback

**File:** `supabase/migrations/20261107000000_s401_permissions.rollback.sql`

Copy `supabase/proposed/2026-11-sm-permissions.rollback.sql` into `migrations/`
renamed with the new timestamp prefix.

### A3. Update proposed/README.md

Replace the S401 row with a "see migration" note so the table stays accurate:

```markdown
| `2026-11-sm-permissions.sql` | S401 / C09 (#31) | Superseded by `migrations/20261107000000_s401_permissions.sql` |
```

Delete `2026-11-sm-permissions.sql` and `.rollback.sql` from `proposed/` after
they are merged into the PR (or keep them as a convenience alias — up to owner).

### A4. Update proposed/test/run.sh

Point the test fixture at the migration file path, not the proposed path:

```bash
q -f "$here/../20261107000000_s401_permissions.sql"
```

### A5. Verify locally

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/proposed/test/run.sh
# Expected: ALL CHECKS PASSED  →  ROLLBACK RESTORES ORIGINAL STATE
```

---

## Part B: Database-backed webhook idempotency

### B1. Problem statement

The webhook handler uses `processedEvents: Set<string>` — a **module-scoped in-memory Set**.
On every Vercel cold start (or any restart), the Set is empty. A Stripe retry of
`customer.subscription.created` or `invoice.payment_succeeded` that arrives after
a cold start will **re-insert rows** into `sm_subscriptions` or `payment_records`
with no database-level guard.

`handleIssuingCardCreated` and `handleIssuingAuthorizationCreated` each do their
own "select-then-insert" check inside the handler, so they survive cold starts.
But the general `processedEvents` Set still skips nothing on a cold start, and
the function-level checks don't cover subscription / invoice paths.

### B2. Migration: `webhook_event_log` table

**File:** `supabase/migrations/20261107000001_webhook_idempotency.sql`

```sql
-- Webhook idempotency: track processed Stripe event IDs so retries
-- never produce duplicate rows.  Only the service role writes;
-- the webhook handler inserts via createSupabaseAdmin().

create table if not exists public.webhook_event_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null,          -- Stripe event id, e.g. evt_1abc...
  event_type    text not null,          -- e.g. issuing_authorization.created
  processed_at  timestamptz not null default now(),
  unique (event_id)                     -- cheap dedup: retry throws 23505
);

-- RLS: only service_role can read/write.
alter table public.webhook_event_log enable row level security;

create policy "service_role full access to webhook_event_log"
  on public.webhook_event_log
  for all using (auth.jwt() ->> 'role' = 'service_role');

-- Cleanup: delete rows older than 90 days.
-- Stripe keeps events for 30 days; 90 is a safe buffer.
create or replace function public.clean_webhook_event_log(max_age_days int)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.webhook_event_log
  where processed_at < now() - (max_age_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.clean_webhook_event_log(int) from public, anon, authenticated;
grant execute on function public.clean_webhook_event_log(int) to service_role;
```

### B3. Webhook handler update

**File:** `api/stripe/webhook.ts`

1. **Remove the in-memory Set.** Delete `const processedEvents = new Set<string>();`
   and every `processedEvents.has(eventId)` / `.add(eventId)` call.

2. **Add a database-backed check before processing.** Insert into
   `webhook_event_log(event_id, event_type)` and **ignore `23505` duplicate-key
   errors** (the event was already processed — return 200 immediately).

   ```typescript
   async function handler(request: Request): Promise<Response> {
     // ...auth, signature, body parsing...

     const eventId = stripeEvent.id;
     const eventType = stripeEvent.type as string;

     // Database-backed idempotency: ignore duplicate-key (already processed).
     const adminClient = createSupabaseAdmin();
     if (adminClient) {
       const { error: dupError } = await adminClient
         .from('webhook_event_log')
         .insert({ event_id: eventId, event_type: eventType });
       // 23505 = unique violation — event was already processed.
       if (dupError && dupError.code === '23505') {
         console.log(`Skipping already-processed event: ${eventId}`);
         return new Response(JSON.stringify({ received: true }), { status: 200 });
       }
       // Real DB error (network, missing table) — fall through; caller sees 500
       // which makes Stripe retry.  The retry will hit the 23505 path.
     }

     console.log('Received Stripe webhook:', eventType);
     // ... rest of handler unchanged ...
   }
   ```

3. **Remove the old Set import / variable.** Delete:
   - `const processedEvents = new Set<string>();` (line ~35)
   - `if (processedEvents.has(eventId)) { ... }` block (lines ~101–107)
   - `processedEvents.add(eventId);` (line ~108)

4. **Keep `handleIssuingCardCreated` / `handleIssuingAuthorizationCreated` as-is.**
   They have their own pre-insert checks which are now redundant but harmless.
   We leave them to avoid changing two more handlers in P0.

### B4. Webhook handler tests

**File:** `api/stripe/__tests__/webhook-idempotency.test.ts`

Three test cases:

```
1. handleIssuingAuthorizationCreated — two identical events in same invocation:
   first inserts, second sees existing row, returns { received: true } without error.

2. handleIssuingAuthorizationCreated — two identical events in separate invocations:
   (mock createSupabaseAdmin to return { error: { code: '23505' } } on second call)
   → returns 200 without re-inserting into card_authorizations.

3. handleSubscriptionEvent — foreign-project skip is still reachable
   (price project !== 'subtrack') and does not throw.
```

Add a test helper:

```typescript
// Mock: simulate duplicate-key error from Supabase.
function mockDuplicateError() {
  return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
}
```

---

## Part C: `@lanonasis/fin-core`

### C1. Decision

**Defer `fin-core` adoption to a later phase.** The P0 spec mentions "fin-core
adopted in the SubTrack webhook" but `@lanonasis/fin-core` is not a dependency
in `package.json` and is not vendored in this repo. P0 can achieve the same
idempotency semantics with the `webhook_event_log` table alone — no external
package required.

**Recommendation:** Add a TODO in `api/stripe/webhook.ts`:

```typescript
// TODO: replace local idempotency with fin-core's runOnce() when
// @lanonasis/fin-core is added as a dependency.
// See docs/specs/CARD_FUNDING_AND_AI_MANAGER.md section 7, P0.
```

When `fin-core` is later added, the migration and the `webhook_event_log`
table are already in place; only the handler call changes from a direct
insert+23505 check to `await runOnce(adminClient, 'webhook_event_log', { event_id, event_type })`.

---

## Execution order

```
1. Part A — move S401 SQL (A1–A5, ~30 min)
2. Part B — write migration (B2, ~20 min)
3. Part B — update webhook handler (B3, ~20 min)
4. Part B — write idempotency tests (B4, ~30 min)
5. Part C — add TODO comment (C1, ~2 min)
6. Run `npm test` — all existing + new tests pass
7. Commit, push, open single PR
```

Total estimated effort: **~2 hours** (including review pass).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `webhook_event_log` table doesn't exist on older deployments | The handler checks `if (adminClient)` before inserting; a missing table throws which returns 500 and makes Stripe retry. On the retry the table exists (migration landed). |
| Duplicate-key 23505 could mask a real constraint violation | Only `webhook_event_log.event_id` has the unique constraint; other tables keep their existing constraints. The error code check (`dupError.code === '23505'`) is narrow. |
| S401 migration applied to live DB breaks client code | The rollback file exists and was tested. The `proposed/` README lists the exact app-level verify steps (add/edit subscription, edit profile name, test-mode checkout). |
| In-memory `Set` removal causes a short gap during the same deployment | The deployment is atomic: new code ships, Stripe's first retry after the deploy will either hit the existing row (from the last in-memory processing before restart) or insert a new one into `webhook_event_log`. No duplicates can occur because the DB check happens before any insert into target tables. |

---

## What this does NOT do (out of scope for P0)

- Envelope set-asides, `sm_envelopes`, `sm_envelope_spend` — **P1**
- `sm_card_rules`, `sm_insights`, `sm_funding_sources` — **P1/P2**
- Real-time authorization rule engine (approve/decline within 2s) — **P2**
- AI insight pipeline — **P1**
- `@lanonasis/fin-core` dependency — deferred (C1)
- Column drift fix on `virtual_cards.subscription_id` FK — tracked separately
