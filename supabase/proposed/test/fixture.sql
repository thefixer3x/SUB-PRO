-- Local stand-in for the live state on 2026-11-06 (no data, no secrets).
-- Mimics the Supabase roles and auth.uid() so the proposed SQL can be tested
-- on a throwaway Postgres. Not for any real database.
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

create table public.sm_feature_flags (name varchar primary key, enabled boolean, updated_at timestamptz);
create function public.sm_update_feature_flag(flag_name varchar, flag_enabled boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into sm_feature_flags (name, enabled) values (flag_name, flag_enabled)
  on conflict (name) do update set enabled = excluded.enabled, updated_at = now();
  return true;
end $$;
grant execute on function public.sm_update_feature_flag(varchar, boolean) to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key,
  full_name text,
  subscription_tier text default 'free',
  stripe_customer_id text,
  updated_at timestamptz
);
create table public.sm_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
create table public.virtual_cards (id uuid primary key default gen_random_uuid(), user_id uuid not null, card_id text, status text);

alter table public.profiles enable row level security;
alter table public.sm_subscriptions enable row level security;
alter table public.virtual_cards enable row level security;
-- Live (Postgres 15) anon had arwdDxt, not MAINTAIN; grant explicitly so the
-- rollback snapshot is meaningful on newer local Postgres servers too.
grant select, insert, update, delete, truncate, references, trigger
  on public.profiles, public.sm_subscriptions, public.virtual_cards to authenticated;
grant all on public.profiles, public.sm_subscriptions, public.virtual_cards to service_role;
grant select, insert, update, delete, truncate, references, trigger
  on public.profiles, public.sm_subscriptions, public.virtual_cards to anon;

create policy "profiles_insert_policy" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_select_policy" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_policy" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users can manage own sm_subscriptions" on public.sm_subscriptions for all to public using (auth.uid() = user_id);
create policy "Users can manage own virtual cards" on public.virtual_cards for all to public using (auth.uid() = user_id);
create policy "Users can view their own virtual cards" on public.virtual_cards for select to authenticated
  using ((select (select auth.uid())) = user_id);
