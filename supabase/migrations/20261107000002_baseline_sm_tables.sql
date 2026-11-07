-- =============================================================================
-- Baseline for the SubTrack tables that production already had.
--
-- `sm_subscriptions`, `sm_payment_records` and the live shape of
-- `virtual_cards` (card_id, cardholder_id, is_locked, nullable stripe_card_id)
-- existed only in the live project and in lib/supabase.ts — no migration
-- created them. That made `supabase db reset` fail at S401 and made the
-- webhook's `virtual_cards.card_id` writes impossible on a fresh database.
--
-- This migration is written to be re-run against production: every statement
-- is `if not exists`, the policy replacement is drop-then-create, and the
-- stripe_card_id backfill only runs when that column is present.
--
-- It follows the already-shipped S401/webhook migrations. S401 skips the
-- sm_subscriptions section when the table is absent on a fresh reset; this
-- migration creates its final owner-CRUD, service-write policy state.
-- =============================================================================

-- 1. sm_subscriptions ---------------------------------------------------------
-- Live columns come from lib/supabase.ts and services/subscriptionService.ts.
create table if not exists public.sm_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  status text not null default 'Active',
  plan_name text not null default 'Standard',
  monthly_cost numeric(10, 2) not null default 0,
  currency text not null default 'USD',
  billing_cycle text not null default 'Monthly',
  renewal_date timestamptz not null default now(),
  payment_method text not null default 'Unknown',
  notes text,
  last_used timestamptz,
  priority text not null default 'Medium',
  deactivation_date timestamptz,
  logo_url text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fill in anything a drifted live table is missing.
alter table public.sm_subscriptions
  add column if not exists category text not null default 'Other',
  add column if not exists status text not null default 'Active',
  add column if not exists plan_name text not null default 'Standard',
  add column if not exists monthly_cost numeric(10, 2) not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists billing_cycle text not null default 'Monthly',
  add column if not exists renewal_date timestamptz not null default now(),
  add column if not exists payment_method text not null default 'Unknown',
  add column if not exists notes text,
  add column if not exists last_used timestamptz,
  add column if not exists priority text not null default 'Medium',
  add column if not exists deactivation_date timestamptz,
  add column if not exists logo_url text,
  add column if not exists color text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists sm_subscriptions_user_id_idx
  on public.sm_subscriptions (user_id);

alter table public.sm_subscriptions enable row level security;

drop policy if exists "Users can manage own sm_subscriptions" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_select" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_insert" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_update" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_delete" on public.sm_subscriptions;

create policy "sm_subscriptions_owner_select" on public.sm_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sm_subscriptions_owner_insert" on public.sm_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sm_subscriptions_owner_update" on public.sm_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sm_subscriptions_owner_delete" on public.sm_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Service role has full access to sm_subscriptions"
  on public.sm_subscriptions;
create policy "Service role has full access to sm_subscriptions"
  on public.sm_subscriptions
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Do not restore `anon` or TRUNCATE access if this baseline is re-applied
-- after S401. RLS does not restrict TRUNCATE.
revoke all on table public.sm_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.sm_subscriptions to authenticated;
grant all on table public.sm_subscriptions to service_role;

-- 2. virtual_cards: align with the fields the app and webhook write ----------
-- The 2025-09 schema used stripe_card_id; live code uses card_id.
alter table public.virtual_cards
  add column if not exists card_id text,
  add column if not exists cardholder_id text,
  add column if not exists is_locked boolean not null default false;

do $$
begin
  -- Live rows are keyed by card_id; older databases keyed by stripe_card_id.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'virtual_cards'
      and column_name = 'stripe_card_id'
  ) then
    execute 'update public.virtual_cards
                set card_id = stripe_card_id
              where card_id is null
                and stripe_card_id is not null';
    execute 'alter table public.virtual_cards
               alter column stripe_card_id drop not null';
  end if;
end $$;

create unique index if not exists virtual_cards_card_id_key
  on public.virtual_cards (card_id)
  where card_id is not null;

-- Owners read their cards; the service role writes them (S401 enforces this).
drop policy if exists "Users can view their own virtual cards" on public.virtual_cards;
create policy "Users can view their own virtual cards"
  on public.virtual_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.virtual_cards from anon, authenticated;
grant select on table public.virtual_cards to authenticated;
grant all on table public.virtual_cards to service_role;

-- 3. card_authorizations join through virtual_cards.card_id -------------------
-- The 2025-09 policy joins on stripe_card_id, which live writes do not set.
-- Older authorization rows have no mode provenance, so fail closed as live.
alter table public.card_authorizations
  add column if not exists livemode boolean not null default true;

drop policy if exists "Users can view own card authorizations" on public.card_authorizations;
create policy "Users can view own card authorizations"
  on public.card_authorizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.virtual_cards vc
      where vc.card_id = card_authorizations.stripe_card_id
        and vc.user_id = (select auth.uid())
    )
  );

-- 4. sm_payment_records -------------------------------------------------------
create table if not exists public.sm_payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  amount numeric(10, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('succeeded', 'failed', 'pending')),
  subscription_id uuid,
  stripe_event_id text,
  created_at timestamptz not null default now()
);

alter table public.sm_payment_records
  add column if not exists stripe_event_id text;

-- Dedupe webhook deliveries by Stripe event id. Existing payment history is
-- retained as-is, including any invoice/status duplicates from older code.
create unique index if not exists sm_payment_records_stripe_event_id_key
  on public.sm_payment_records (stripe_event_id)
  where stripe_event_id is not null;

create index if not exists sm_payment_records_user_id_idx
  on public.sm_payment_records (user_id);

alter table public.sm_payment_records enable row level security;

drop policy if exists "Users can view own sm_payment_records" on public.sm_payment_records;
create policy "Users can view own sm_payment_records"
  on public.sm_payment_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role has full access to sm_payment_records"
  on public.sm_payment_records;
create policy "Service role has full access to sm_payment_records"
  on public.sm_payment_records
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.sm_payment_records from anon, authenticated;
grant select on table public.sm_payment_records to authenticated;
grant all on table public.sm_payment_records to service_role;
