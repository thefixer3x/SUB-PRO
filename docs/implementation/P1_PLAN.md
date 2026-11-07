# P1 — Envelopes and the Plan inbox

Status: **implementation complete; deployment/TestSprite verification pending**.
This branch is stacked on `fix/p0-idempotency-semantics` and does not create
cards, charge cards, hold funds, or call an AI provider.

## Product decisions carried into implementation

- Insights are visible to Free, Pro, and Team users (F7).
- A user must explicitly opt in before a scan reads subscription or card-event
  data (F5). Turning consent off deletes their saved insights.
- Accepting an insight is Pro-gated. In P1 it records the user's choice only;
  it does not create a card rule or perform an action. Rule execution remains
  out of scope until P3.
- The insight engine is deterministic and produces plain-text explanations.
  No card number, security code, credential, or prompt is sent to an AI provider.
- Card authorization insights and envelope linking run only when
  `STRIPE_SECRET_KEY` is explicitly a test key (`sk_test_…` or `rk_test_…`),
  and each authorization has `livemode = false`. Existing rows without mode
  provenance are backfilled as live. Subscription-only insights still work.
- Envelope amounts are in minor units and totals never mix currencies.

## Delivered in this branch

### Database

- `20261107000004_envelopes.sql`: owner-readable `sm_envelopes` and
  `sm_envelope_spend`; writes are service-role-only. A unique authorization
  index prevents double-counting. It ensures the P0 `livemode` provenance
  column exists, defaulting existing/unmarked rows to live.
- `20261107000005_insights.sql`: owner-readable `sm_insights` and opt-in
  `sm_ai_consent`; writes are service-role-only. Insights cascade-delete with
  the user profile and have a unique user/dedupe key.

### Insight engine and consent

- `services/insightEngine.ts`: deterministic detectors for price increases,
  new recurring merchants, unused-before-renewal, duplicate subscriptions,
  and envelopes at risk. Explanations include the source record ids.
- `server/insights.ts`: consent is checked before any data reads; owner ids
  from `requireUser` scope every service-role query; insights are deduped by a
  unique key and upsert.
- `server/p1-api.ts` dispatches the Vercel function
  `api/embedded-finance/plan/[...path].ts`. Endpoints under
  `/api/embedded-finance/plan/*` list insights, scan, read/update consent, and
  accept/dismiss an insight. The server—not the client—enforces Pro for accept.

### Envelopes

- `services/envelopeMath.ts` and `server/envelopes.ts`: currency-safe summaries,
  input validation, CRUD, and idempotent authorization matching.
- The same Vercel function creates/lists/updates/deletes envelopes and returns
  current-month summaries. The client uses the established `/api` base URL;
  the mobile build appends `embedded-finance/plan/...` to that configured base.
- `api/jobs/envelope-spend-link.ts`: nightly Vercel job, protected by
  `CRON_SECRET`, which re-scans the current month to recover missed runs and
  pre-deploy test authorizations. It skips unless Stripe and the individual
  authorization are in test mode.
  `vercel.json` schedules it at 03:00 UTC.
- `components/PlanInbox.tsx`: dashboard inbox, consent controls, dismiss/Pro
  accept actions, and monthly set-aside creation/progress. It uses the existing
  app theme and shows insights to Free users.

## Data availability

`sm_subscriptions` can immediately support unused-renewal, duplicate, and
envelope-at-risk insights. `card_authorizations` is expected to remain empty
until P2 issues test cards, so price-increase and new-recurring detectors are
unit-tested but may not produce results yet.

## Verification

- Jest covers detector thresholds, currency boundaries, consent-before-read,
  deduplication, envelope matching, and Pro accept gating.
- A fresh PostgreSQL 17 migration chain applies all migration files and checks
  P1 RLS/table grants.
- The older `20250701_rls_policy_wrappers.sql` had a nested dollar-quote parse
  error; its outer `DO` block now uses a distinct delimiter so a fresh database
  can run the chain.
- `npm run check-migrations` guards duplicate/invalid migration names. The
  existing duplicate `20250701` version remains allowlisted to avoid changing
  migration history.

## Not in P1

- Card funding, money movement, real-time authorization decisions, or live-mode
  operations.
- AI-generated explanations, external model calls, or card data in prompts.
- Creating `sm_card_rules` or running a rule from an accepted insight (P3).
- Live authorization analysis. The migration stores `livemode`, backfills
  unknown existing rows as live, and the test-key guard remains in place.
