-- =============================================================================
-- P1 / F3: envelopes (budget-only set-asides, no money held).
--
-- An envelope is a monthly ceiling such as "Streaming, $30". Authorizations are
-- matched to it by category (or, when the category is empty, by merchant name).
-- Spending is stored in `sm_envelope_spend` so the Plan inbox and the dashboard
-- can show "spent / remaining" without scanning authorizations on every read.
--
-- Following S401: owners read their rows; only the service role writes. The
-- API routes use requireUser + the service role, never the client key.
-- =============================================================================

-- Existing authorization rows have no Stripe mode provenance. Mark them live
-- (fail closed); new webhook rows explicitly write event.livemode.
alter table public.card_authorizations
  add column if not exists livemode boolean not null default true;

create table if not exists public.sm_envelopes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  currency            text not null default 'USD',
  monthly_amount_minor integer not null check (monthly_amount_minor >= 0),
  category_filter     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists sm_envelopes_user_id_idx
  on public.sm_envelopes (user_id);

alter table public.sm_envelopes enable row level security;

drop policy if exists "sm_envelopes_owner_select" on public.sm_envelopes;
create policy "sm_envelopes_owner_select"
  on public.sm_envelopes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role has full access to sm_envelopes" on public.sm_envelopes;
create policy "Service role has full access to sm_envelopes"
  on public.sm_envelopes
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.sm_envelopes from anon, authenticated;
grant select on table public.sm_envelopes to authenticated;
grant all on table public.sm_envelopes to service_role;

-- ---------------------------------------------------------------------------
-- sm_envelope_spend: one row per matched authorization.
-- ---------------------------------------------------------------------------
create table if not exists public.sm_envelope_spend (
  id                     uuid primary key default gen_random_uuid(),
  envelope_id            uuid not null references public.sm_envelopes(id) on delete cascade,
  card_authorization_id  uuid references public.card_authorizations(id) on delete set null,
  amount_minor           integer not null,
  currency               text not null,
  transaction_date       timestamptz not null,
  month                  text not null,   -- 'YYYY-MM', UTC
  created_at             timestamptz not null default now()
);

-- A card authorization belongs to at most one envelope, so a re-run of the
-- linking job cannot double-count. Rows from a future detected-transaction
-- source have a null authorization id and are left alone.
create unique index if not exists sm_envelope_spend_authorization_key
  on public.sm_envelope_spend (card_authorization_id)
  where card_authorization_id is not null;

create index if not exists sm_envelope_spend_envelope_month_idx
  on public.sm_envelope_spend (envelope_id, month);

alter table public.sm_envelope_spend enable row level security;

drop policy if exists "sm_envelope_spend_owner_select" on public.sm_envelope_spend;
create policy "sm_envelope_spend_owner_select"
  on public.sm_envelope_spend
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.sm_envelopes e
       where e.id = sm_envelope_spend.envelope_id
         and e.user_id = (select auth.uid())
    )
  );

drop policy if exists "Service role has full access to sm_envelope_spend"
  on public.sm_envelope_spend;
create policy "Service role has full access to sm_envelope_spend"
  on public.sm_envelope_spend
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.sm_envelope_spend from anon, authenticated;
grant select on table public.sm_envelope_spend to authenticated;
grant all on table public.sm_envelope_spend to service_role;
