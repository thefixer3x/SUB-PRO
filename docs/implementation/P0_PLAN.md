# Plan: P0 — S401 permissions + database-backed webhook idempotency

Status: **implemented** — both migrations run on a fresh database and on a
database that already applied the previous idempotency table. The two P0 test
suites pass (36/36: `s201-checkout-webhook`, `webhook-idempotency`).

## P0 done-when (verified)

> [x] S401 permissions migration is in `supabase/migrations/` and its harness
>     reports `ALL CHECKS PASSED` + `ROLLBACK RESTORES ORIGINAL STATE`
> [x] `supabase/proposed/2026-11-sm-permissions.sql` is superseded by the migration
> [x] Webhook idempotency is backed by `webhook_event_log`; a finished event is
>     skipped, a failed effect is retried by Stripe
> [x] No client role can write to `virtual_cards`, `profiles.subscription_tier`,
>     or `profiles.stripe_customer_id`
> [x] `supabase db reset` has a migration for every table the code writes

---

## Part A: S401 from `proposed/` → `migrations/` — DONE

### Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261107000000_s401_permissions.sql` | The permission fixes |
| `supabase/rollbacks/20261107000000_s401_permissions.rollback.sql` | Exact rollback |

The rollback deliberately lives outside `supabase/migrations/`. The Supabase
CLI parses `^([0-9]+)_(.*)\.sql$` and byte-sorts, so
`20261107000000_s401_permissions.rollback.sql` sorts **before**
`20261107000000_s401_permissions.sql` and would be the file the CLI runs.

### Verification

`supabase/proposed/test/run.sh` applies the shipped migration to a stand-in
database, runs the behaviour checks, applies the shipped rollback, and diffs
grants/policies before and after. It now runs on PostgreSQL 17 as well as the
live PostgreSQL 15: the fixture grants `anon` the live `arwdDxt` set explicitly
instead of `grant all` (which adds `MAINTAIN` on 17).

---

## Part B: Database-backed webhook idempotency — DONE

### B1. Migration: `webhook_event_log`

**File:** `supabase/migrations/20261107000001_webhook_idempotency.sql`

Semantics are **claim → effect → mark done**:

| RPC | Meaning |
| --- | --- |
| `claim_webhook_event(event_id, event_type, stale_after)` | `claimed`, `duplicate`, or `in_progress` |
| `mark_webhook_event_done(event_id)` | Runs after the effect succeeds |
| `release_webhook_event(event_id)` | Deletes an unfinished claim so the retry can run |

Details:

- `status in ('processing','done')`, `attempts`, `updated_at`.
- A `processing` claim older than `stale_after` (default 10 min) is reclaimed,
  covering a crashed invocation.
- Claiming fails closed after 3 attempts (raises → HTTP 500 → Stripe retries).
- Only `service_role` may execute the RPCs or touch the table.
- The migration is re-appliable. The legacy backfill (old rows → `done`) runs
  only when the `status` column is first added, so re-applying never rewrites
  in-flight claims.
- `clean_webhook_event_log(max_age_days)` supports the 90-day cleanup.

### B2. Webhook handler

**File:** `api/stripe/webhook.ts`

- Removed the in-memory `Set<string>`.
- Every handled event goes through `runIdempotently(event, effect)`:
  - `duplicate` / `in_progress` → 200, no effect.
  - effect succeeds → `mark_webhook_event_done`.
  - effect throws → `release_webhook_event` then re-throw → 500 → Stripe retries.
  - claim error → 500, no effect (fail closed).
  - mark-done error → still 200: the effect already ran, and a stale claim is
    reclaimable after the window.
- Foreign-project events still return 200 **before** claiming, so we do not
  write log rows for `vortexcore` traffic.
- DB write errors now throw instead of being swallowed. `23505` is still
  tolerated on the target inserts as a secondary guard.
- `sm_payment_records.subscription_id` receives `asUuid(subscriptionId)`; the
  Stripe `sub_…` id is never written into a uuid column.

### B3. Tests

**File:** `__tests__/webhook-idempotency.test.ts` — 9 cases:

```
✓ duplicate / in_progress → 200, no write, no mark-done
✓ claimed → effect once, then mark done
✓ failed effect → 500 + release, retry applies it once
✓ claim RPC error → 500, no write (fail closed)
✓ admin client missing → 500, no write (fail closed)
✓ mark-done error → 200 (effect already ran)
✓ invoice event stores subscription_id = null for sub_…
✓ foreign-project event → 200 skipped, never claimed
```

`__tests__/s201-checkout-webhook.test.ts` (27 cases) keeps its Accept-when
coverage; its service mock now answers the `rpc` calls with `claimed`.

`jest.config.js` ignores `.worktrees/`, so a stale worktree copy cannot make a
suite pass or fail in place of the working tree.

### Design decisions

- **Idempotency after the project filter** for subscription/invoice/checkout
  events — avoids writing `webhook_event_log` rows for events we skip.
- **Issuing handlers claim at the top** — they have no project filter, so they
  always process.
- **Fail closed** — a missing table or RPC error returns 500. The previous
  version failed open (swallowed the error and processed).

---

## Part C: Baseline schema migration — DONE

**File:** `supabase/migrations/20261106000000_baseline_sm_tables.sql`

`sm_subscriptions`, `sm_payment_records`, and the live shape of
`virtual_cards` existed only in the live project and in `lib/supabase.ts`, so a
fresh database could not run S401 or the webhook. The baseline adds:

- `sm_subscriptions` with the live columns, RLS, the pre-S401 `FOR ALL` policy,
  and the grants the rollback restores.
- `virtual_cards.card_id` / `cardholder_id` / `is_locked`, a nullable
  `stripe_card_id`, a unique index on `card_id`, and the owner SELECT policy.
- `card_authorizations` owner policy joining through `virtual_cards.card_id`
  (the 2025-09 policy joined on `stripe_card_id`, which live writes do not set).
- `sm_payment_records` plus the `(stripe_invoice_id, status)` unique index the
  webhook relies on.

Every statement is `if not exists` / drop-then-create, so it is safe to apply
to production, which already has these objects.

---

## Part D: Migration-name guard — DONE

**File:** `scripts/check-migrations.js`, run with `npm run check-migrations`.

Fails when a file in `supabase/migrations/` does not match
`<version>_<name>.sql` or when two files share a version. The legacy
`20250701` pair is allowlisted because both files were already applied and
renaming them would desync every environment's history.

---

## Part E: `@lanonasis/fin-core` — DEFERRED

When adopted, replace the RPC helpers with
`runOnce(adminClient, 'webhook_event_log', { event_id, event_type })`. See
`docs/specs/CARD_FUNDING_AND_AI_MANAGER.md` section 7, P0.

---

## Files changed

| File | Action | Purpose |
| --- | --- | --- |
| `supabase/migrations/20261106000000_baseline_sm_tables.sql` | Created | Tables the code already wrote |
| `supabase/migrations/20261107000000_s401_permissions.sql` | Created | S401 permission fixes |
| `supabase/rollbacks/20261107000000_s401_permissions.rollback.sql` | Moved | Rollback, out of the CLI's path |
| `supabase/migrations/20261107000001_webhook_idempotency.sql` | Created | Claim/done/release RPCs + cleanup |
| `api/stripe/webhook.ts` | Modified | Claim → effect → done, fail closed |
| `supabase/proposed/README.md` | Modified | Points at the shipped files |
| `supabase/proposed/test/run.sh` | Modified | Correct paths; tests shipped files |
| `supabase/proposed/test/fixture.sql` | Modified | Matches live anon grants on PG17 |
| `scripts/check-migrations.js` | Created | Duplicate/invalid-name guard |
| `package.json` | Modified | `check-migrations` script |
| `jest.config.js` | Modified | Ignore `.worktrees/` |
| `__tests__/webhook-idempotency.test.ts` | Rewritten | Claim/done/release semantics |
| `__tests__/s201-checkout-webhook.test.ts` | Modified | Mock the idempotency RPCs |
