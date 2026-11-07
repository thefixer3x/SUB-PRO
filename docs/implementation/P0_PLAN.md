# P0 — S401 permissions and webhook idempotency

Status: **implementation complete; forward migrations and PR review pending**.

## Migration rollout

The default branch already recorded versions `20261107000000` and
`20261107000001`; those versions are not rewritten to carry new SQL. The P0
upgrade is forward-only:

| Version | File | Purpose |
| --- | --- | --- |
| `20261107000000` | `20261107000000_s401_permissions.sql` | Shipped S401. Its `sm_subscriptions` block skips a missing table on fresh reset. |
| `20261107000001` | `20261107000001_webhook_idempotency.sql` | Existing insert-first event log migration; unchanged from `main`. |
| `20261107000002` | `20261107000002_baseline_sm_tables.sql` | Baseline for existing live tables not represented in the repo schema. |
| `20261107000003` | `20261107000003_webhook_claim_idempotency.sql` | Forward upgrade to token-fenced claim/complete/release semantics and billing-state ordering. |

Versions `02` and `03` sort after the versions already recorded remotely, so
normal `supabase db push` applies them without editing or repairing the remote
migration ledger.

## S401 permissions

- `virtual_cards`: authenticated users can read their own rows; only the service
  role can insert/update/delete. RLS does not cover `TRUNCATE`, so client write
  and truncate privileges are revoked explicitly.
- `sm_subscriptions`: authenticated users retain owner-scoped CRUD, but not
  `TRUNCATE`; `anon` has no table access. On a fresh reset, S401 skips this table
  because the baseline creates it later in the final owner-CRUD state.
- `profiles`: client roles cannot change `subscription_tier` or
  `stripe_customer_id`.
- The rollback is under `supabase/rollbacks/`, outside the Supabase CLI's
  migration filename scan.

## Baseline schema

`20261107000002_baseline_sm_tables.sql` reconciles the live schema needed by the
webhook and app: `sm_subscriptions`, `sm_payment_records`, and the live
`virtual_cards.card_id` shape. It is safe after S401: it does not restore `anon`
privileges, client writes to cards, `TRUNCATE`, or the broad legacy subscription
policy. Reapplying it preserves the hardened state.

Payment rows are deduped by `stripe_event_id`, not by a new unique constraint on
`(stripe_invoice_id, status)`. Existing payment history, including duplicate
invoice/status pairs, is left intact.

## Webhook idempotency

The new `20261107000003` migration upgrades the already-shipped event table:

- Legacy rows and legacy inserts default to `done`.
- `claim_webhook_event` returns `claimed` with a unique claim token,
  `duplicate`, or `in_progress`.
- A stale claim is reclaimed with a new token. Complete/release RPCs only act
  when their token matches the current claim, so an old invocation cannot
  release or complete a newer attempt.
- A completed duplicate returns 200. `in_progress` returns a retryable 500.
  Effect/complete errors release only the current token and return 500.
- RPC/table access is service-role-only.

`api/stripe/webhook.ts` claims before Stripe or database reads, so duplicate
deliveries are cheap. Foreign-project events still have no target-table effect;
they are acknowledged as skipped after the event claim is completed.

### Subscription ordering and retry safety

- Subscription handlers retrieve the current Stripe subscription rather than
  trusting a potentially stale event snapshot.
- `begin_subscription_tier_sync` gives each per-user billing sync a monotonic
  generation before Stripe state is retrieved. Initial sync reconciles against
  the customer's latest SubTrack subscription.
- `apply_subscription_tier_event` atomically checks the generation and
  subscription creation before updating `profiles.subscription_tier`. It
  reports stale events without overwriting a newer state and reports missing
  profiles as retryable failures; it does not rely on Stripe event timestamps
  for ordering.
- Invoice records use the Stripe event id for secondary deduplication.
- `issuing_card.created` retrieves the current card once if its event snapshot
  lacks `metadata.user_id`, then retries if metadata is still missing.

## Tests and checks

- `npm run check-migrations` runs in CI and immediately before the deployment
  script invokes `supabase db push`. It rejects rollback files, mixed-case or
  malformed SQL filenames, and duplicate versions; only the exact existing
  `20250701` pair is allowlisted.
- `supabase/proposed/test/run.sh` tests S401 and rollback, then runs
  `run-baseline.sh`. The baseline runner applies S401, the forward baseline and
  webhook upgrade, re-applies the baseline, and checks grants/RLS, claim token
  fencing, retry release, legacy-row defaults, payment history and subscription
  event ordering.
- `jest.config.js` scopes `.worktrees` exclusion to the active Jest root.

Do not change an already-recorded migration to deploy new behavior; add a new
versioned migration instead. `@lanonasis/fin-core` remains deferred.
