-- Minimal pre-P0 schema for baseline -> S401 -> baseline-reapply integration.
-- Run only on a throwaway Postgres database.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.sm_feature_flags (
  name varchar primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create function public.sm_update_feature_flag(flag_name varchar, flag_enabled boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.sm_feature_flags (name, enabled)
  values (flag_name, flag_enabled)
  on conflict (name) do update set enabled = excluded.enabled, updated_at = now();
  return true;
end $$;
grant execute on function public.sm_update_feature_flag(varchar, boolean)
  to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  subscription_tier text not null default 'free',
  stripe_customer_id text,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (id uuid primary key default gen_random_uuid());
create table public.virtual_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  stripe_card_id text not null unique,
  last4 text not null,
  brand text not null,
  status text not null,
  subscription_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.card_authorizations (
  id uuid primary key default gen_random_uuid(),
  stripe_authorization_id text not null unique,
  stripe_card_id text not null,
  amount integer not null,
  currency text not null default 'usd',
  merchant_name text not null,
  merchant_category text not null default 'general',
  approved boolean not null,
  transaction_date timestamptz not null,
  created_at timestamptz not null default now()
);

insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.test');
insert into public.virtual_cards (user_id, stripe_card_id, last4, brand, status)
values ('11111111-1111-4111-8111-111111111111', 'ic_legacy', '4242', 'visa', 'active');
insert into public.card_authorizations
  (stripe_authorization_id, stripe_card_id, amount, currency, merchant_name, approved, transaction_date)
values ('ia_legacy', 'ic_legacy', 1000, 'usd', 'Test Merchant', true, now());

alter table public.profiles enable row level security;
alter table public.virtual_cards enable row level security;
alter table public.card_authorizations enable row level security;

grant all on public.profiles, public.subscriptions, public.virtual_cards,
  public.card_authorizations to anon, authenticated, service_role;

create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id);
create policy "Users can manage own virtual cards" on public.virtual_cards
  for all to public using ((select auth.uid()) = user_id);
create policy "Service role has full access to virtual cards" on public.virtual_cards
  for all using (auth.jwt() ->> 'role' = 'service_role');
create policy "Users can view own card authorizations" on public.card_authorizations
  for select to authenticated using (
    exists (
      select 1 from public.virtual_cards vc
       where vc.stripe_card_id = card_authorizations.stripe_card_id
         and vc.user_id = (select auth.uid())
    )
  );
