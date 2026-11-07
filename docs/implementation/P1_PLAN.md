# Plan: P1 — Envelopes + Plan inbox + first 3 insights

Status: **draft** — not yet applied. All work is test-mode.

## P1 done-when

> [ ] `sm_envelopes` table exists with RLS (owner CRUD); `sm_envelope_spend` links authorizations to envelopes
> [ ] User can create an envelope ("Streaming $30/mo") and see spend against it from `card_authorizations`
> [ ] Insight table `sm_insights` exists with owner CRUD; 3 insights appear with plain-text explanations
> [ ] Price-increase insight: same merchant, amount up >X% vs last charge
> [ ] New-recurring-merchant insight: second charge from a merchant on monthly rhythm
> [ ] Unused-before-renewal insight: no `last_used` before renewal_date
> [ ] Insights have a "View" button in the Plan inbox (dashboard section); dismissed = `status: 'dismissed'`

---

## Part A: Envelope tables

### A1. Migration: `sm_envelopes` + `sm_envelope_spend`

**File:** `supabase/migrations/20261107000002_envelopes.sql`

```sql
-- Envelope set-asides: budget-only (no money held).
-- Authorizations are matched to envelopes by merchant_category or merchant_name.

create table if not exists public.sm_envelopes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  name            text not null,                -- e.g. "Streaming", "Utilities"
  currency        text not null default 'USD',  -- ISO 4217
  monthly_amount  integer not null,             -- minor units
  category_filter text,                         -- optional: matches card_authorizations.merchant_category
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.sm_envelopes enable row level security;

create policy "sm_envelopes_owner_select" on public.sm_envelopes
  for select to authenticated using (auth.uid() = user_id);

create policy "sm_envelopes_owner_insert" on public.sm_envelopes
  for insert to authenticated with check (auth.uid() = user_id);

create policy "sm_envelopes_owner_update" on public.sm_envelopes
  for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "sm_envelopes_owner_delete" on public.sm_envelopes
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists sm_envelopes_user_id_idx on public.sm_envelopes (user_id);

-- Spending against envelopes (linked to card_authorizations rows).
create table if not exists public.sm_envelope_spend (
  id                  uuid primary key default gen_random_uuid(),
  envelope_id         uuid not null references public.sm_envelopes(id) on delete cascade,
  card_authorization_id uuid references public.card_authorizations(id) on delete set null,
  amount_minor        integer not null,
  currency            text not null,
  transaction_date    timestamptz not null,
  month               text not null,            -- 'YYYY-MM' for grouping
  created_at          timestamptz not null default now()
);

alter table public.sm_envelope_spend enable row level security;

create policy "sm_envelope_spend_owner_select" on public.sm_envelope_spend
  for select to authenticated using (
    auth.uid() = (select user_id from public.sm_envelopes where id = sm_envelope_spend.envelope_id)
  );

create policy "sm_envelope_spend_service_write" on public.sm_envelope_spend
  for insert to service_role using (true) with check (true);

create index if not exists sm_envelope_spend_envelope_month_idx
  on public.sm_envelope_spend (envelope_id, month);
```

**RLS note:** `sm_envelope_spend` uses a subquery to resolve the envelope's owner. This is safe because only the service role writes to this table (the envelope-linking job runs server-side), and authenticated users only SELECT (RLS scoped to their envelopes).

---

## Part B: Insight engine tables + service

### B1. Migration: `sm_insights`

**File:** `supabase/migrations/20261107000003_insights.sql`

```sql
-- AI subscription insights: user-visible, owner-readable.
-- The service role writes; the UI reads and allows accept/dismiss.

create table if not exists public.sm_insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  type            text not null check (type in (
    'price_increase', 'new_recurring_merchant', 'unused_before_renewal',
    'duplicate_subscription', 'envelope_at_risk', 'cheaper_plan'
  )),
  payload         jsonb not null,              -- structured data for explanation + action
  source_event_ids text[] default '{}',         -- card_authorization.id or sm_subscriptions.id
  status          text not null default 'new' check (status in ('new', 'accepted', 'dismissed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.sm_insights enable row level security;

create policy "sm_insights_owner_select" on public.sm_insights
  for select to authenticated using (auth.uid() = user_id);

create policy "sm_insights_owner_insert" on public.sm_insights
  for insert to authenticated with check (auth.uid() = user_id);

create policy "sm_insights_owner_update" on public.sm_insights
  for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists sm_insights_user_status_idx on public.sm_insights (user_id, status);
create index if not exists sm_insights_user_created_idx on public.sm_insights (user_id, created_at desc);
```

### B2. Insight engine service

**File:** `services/insightEngine.ts` (new)

A service class with three public methods that produce `InsightEvent[]`:

```typescript
interface InsightEvent {
  type: 'price_increase' | 'new_recurring_merchant' | 'unused_before_renewal';
  payload: Record<string, unknown>;
  source_event_ids: string[];
  explanation: string;  // plain-text for the inbox
}

class InsightEngine {
  /**
   * Price increase: same merchant, amount higher than last time by > threshold%.
   * Data source: card_authorizations grouped by merchant_name, sorted by transaction_date.
   */
  async detectPriceIncreases(userId: string, thresholdPct = 10): Promise<InsightEvent[]>;

  /**
   * New recurring merchant: second charge from a merchant on monthly/yearly rhythm.
   * Data source: card_authorizations — merchant appears ≥ 2 times with ~30-day intervals.
   */
  async detectNewRecurringMerchant(userId: string): Promise<InsightEvent[]>;

  /**
   * Unused before renewal: no last_used before sm_subscriptions.renewal_date.
   * Data source: sm_subscriptions where renewal_date is within 7 days and last_used is null
   * or older than N days.
   */
  async detectUnusedBeforeRenewal(userId: string, daysBeforeRenewal = 7): Promise<InsightEvent[]>;

  /**
   * Upsert insights: creates new rows, skips if same type+payload already exists this month.
   */
  async upsertInsights(userId: string, insights: InsightEvent[]): Promise<number>;
}
```

**Detection details:**

- **Price increase**: Query `card_authorizations` where `user_id` = userId via a join to `virtual_cards.stripe_card_id`. Group by `merchant_name`, sort by `transaction_date`. Compare consecutive charges: if `current_amount > previous_amount * (1 + thresholdPct/100)`, create insight. Explanation: "Netflix went from $15.99 to $19.99 — a 25% increase."

- **New recurring merchant**: Query `card_authorizations` grouped by `merchant_name`. If ≥ 2 charges exist and the interval between them is within ±5 days of 30 days (monthly) or 365 days (yearly), flag as recurring. Explanation: "You've been charged by Canva twice in 32 days — this looks like a recurring subscription."

- **Unused before renewal**: Query `sm_subscriptions` where `renewal_date` ≤ now + 7 days AND (`last_used` IS NULL OR `last_used` < now - 30 days). Explanation: "Spotify renews in 5 days and you haven't used it in 45 days."

**Upsert logic:** Before inserting, check if a `new` insight of the same `type` with overlapping `source_event_ids` exists for this user within the same month. If so, skip (prevents duplicate insights from repeated runs).

### B3. Insight engine tests

**File:** `__tests__/insightEngine.test.ts`

Six test cases:

```
1. Price increase detected: same merchant, amount up 15% → insight created
2. Price increase NOT detected: same merchant, amount up 5% (below threshold) → no insight
3. New recurring merchant: two charges 31 days apart → insight created
4. New recurring merchant NOT detected: two charges 10 days apart (not recurring) → no insight
5. Unused before renewal: renewal in 3 days, last_used 45 days ago → insight created
6. Unused before renewal NOT detected: renewal in 3 days, last_used 2 days ago → no insight
```

---

## Part C: Plan inbox UI

### C1. Dashboard section + InsightCard component

**File:** `components/PlanInbox.tsx` (new)

Renders a list of `sm_insights` rows for the current user. Each row:

```tsx
<InsightCard
  type={insight.type}
  explanation={insight.explanation}
  status={insight.status}
  onDismiss={() => updateStatus(insight.id, 'dismissed')}
  onAccept={() => {
    updateStatus(insight.id, 'accepted');
    // For price_increase: could trigger a sm_card_rules insert (P3)
    // For unused_before_renewal: could open a cancel flow
  }}
/>
```

**Layout:** A vertical card list on mobile, inline cards on web. Uses the existing `FeatureGate` component with `smartInsights` feature flag (already in `config/subscriptionPlans.ts`). Free users see a "Upgrade to Pro for AI-powered insights" placeholder; Pro/Team users see the actual inbox.

**Status badges:**
- `new` → blue dot + "New"
- `accepted` → green check + "Acted on"
- `dismissed` → gray + hidden (not shown by default, toggle to see all)

### C2. Dashboard integration

**File:** `app/(tabs)/index.tsx` (modify)

Replace the current "Smart Insights" placeholder section (line ~169) with a real `PlanInbox` component when the user has `smartInsights` access.

### C3. Insight update API route

**File:** `app/api/embedded-finance/insights/[id]+api.ts` (new)

```typescript
// PATCH /api/embedded-finance/insights/:id
// Accepts { action: 'dismiss' | 'accept' }
// Updates sm_insights.status via service_role
```

---

## Part D: Linking spend to envelopes

### D1. Server job (Vercel function)

**File:** `api/jobs/envelope-spend-link+api.ts` (new, cron-triggered)

Runs nightly. For each `card_authorization` within the last 24 hours, matches it to an envelope by:
1. `merchant_category` match to `envelope.category_filter`
2. If no match, `merchant_name` match to `envelope.name` (substring, case-insensitive)

Creates `sm_envelope_spend` rows. Explanation: "Matched $15.99 Netflix charge to your 'Streaming' envelope."

### D2. Envelope spend summary endpoint

**File:** `app/api/embedded-finance/envelopes/summary+api.ts` (new)

Returns per-user: `[{ envelope, spent, remaining, month }]`

Used by the dashboard to show envelope progress bars.

---

## Execution order

```
1. Part A — envelope migrations (A1, ~45 min)
2. Part B1 — insight table migration (B1, ~20 min)
3. Part B2 — insight engine service + tests (B2+B3, ~2h)
4. Part C — Plan inbox UI + API route (C1–C3, ~1.5h)
5. Part D — spend-linking job + summary endpoint (D1–D2, ~1h)
6. Run `npm test` — all existing + new tests pass
7. Commit, push, open single PR
```

Total estimated effort: **~5.5 hours** (including review pass).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `card_authorizations` may have stale merchant data (card_brand instead of real merchant) | The envelope-matching job uses substring matching on `merchant_name` and logs unmatched rows. P2 (pay-through) will produce richer authorization data. |
| Insight detection runs on potentially small data sets (few charges per user) | P1 insights are "best effort" — they work well once the user has ≥ 3 charges. UI shows empty state ("No insights yet — add a subscription or link a card to get started"). |
| `sm_envelopes` + `sm_envelope_spend` RLS subquery performance | Index on `sm_envelopes(user_id)` + index on `sm_envelope_spend(envelope_id, month)` ensures lookups are fast. For users with > 100 envelopes (unlikely), a partial index could be added. |
| AI provider not selected yet (F5) | P1 insights are **deterministic** (SQL queries + JS logic, no LLM). Explanation text is hand-authored templates. When an AI provider is selected, explanations can be upgraded to LLM-generated. |
| `sm_insights` needs to link to future `sm_card_rules` actions | The `payload` JSONB column is flexible — P3 actions (cancel, downgrade, lock merchant) can be encoded there. No schema change needed. |

---

## Out of scope (later phases)

- **Card funding (F1 pay-through)** — **P2**
- **Merchant-locked cards (T2)** — **P3**
- **Partner-held balances (F2)** — **P4**
- **Real-time authorization rule engine** — **P2**
- **Monthly plan generation** (AI-proposed next month's set-asides) — requires AI provider (F5)
- **`@lanonasis/fin-core`** — deferred until adopted
- **Duplicate subscription detection** — `sm_insights.type` column supports it, but not implemented in P1 (the spec lists it; P1 ships only the first 3)
- **Envelope "at risk" insight** — depends on envelope spend tracking being accurate (P1, but complexity is lower priority)

---

## Data model relationships (diagram)

```
sm_envelopes ──1:N── sm_envelope_spend ──N:1── card_authorizations
                                                          │
sm_insights ──N:M (via source_event_ids) ── card_authorizations
sm_insights ──N:M (via source_event_ids) ── sm_subscriptions
```

---

## Spec alignment

| Spec section | P1 delivery |
|---|---|
| §5 Insight: Price increase | ✅ `detectPriceIncreases()` |
| §5 Insight: New recurring merchant | ✅ `detectNewRecurringMerchant()` |
| §5 Insight: Unused before renewal | ✅ `detectUnusedBeforeRenewal()` |
| §5 Insight: Duplicate | ⬜ Defers to later phase (type supported in schema) |
| §5 Insight: Envelope at risk | ⬜ Defers (depends on spend tracking accuracy) |
| §5 Insight: Cheaper plan | ⬜ Defers (needs AI provider F5) |
| §5 Plan inbox | ✅ `PlanInbox` component + dashboard integration |
| §5 Guardrail: AI never moves money | ✅ P1 insights are read-only; accept/dismiss only changes status |
| §5 Guardrail: Opt-in before insights | ✅ `smartInsights` feature flag gating (already in `subscriptionPlans.ts`) |
| §6 Data model | ✅ `sm_envelopes`, `sm_envelope_spend`, `sm_insights` |
| §7 Phase P1 | ✅ Envelopes + 3 insights + Plan inbox, no card funding |
| §7 P1 done-when | ✅ User creates envelope, sees spend, insights appear with explanations |
