-- =============================================================================
-- S401 / C09 (#31): permission fixes for the live SubTrack tables
-- Project: the shared Supabase project used by SubTrack Pro and VortexCore.
--
-- STATUS: MIGRATED. Applied to production after owner review.
--
-- What it changes (the live state it replaces was read on 2026-11-06):
--
--   1. public.sm_update_feature_flag(varchar, boolean)
--      SECURITY DEFINER, and EXECUTE was granted to PUBLIC, anon and
--      authenticated. Only archived code calls it. -> service_role only.
--
--   2. public.virtual_cards
--      Owner policy "Users can manage own virtual cards" was FOR ALL, so a
--      signed-in user could insert or edit card rows (status, limits). Every
--      write in the code goes through the service role (server/virtual-cards.ts,
--      api/stripe/webhook.ts), which bypasses RLS. -> owner SELECT only (the
--      existing "Users can view their own virtual cards" policy stays).
--
--   3. public.sm_subscriptions
--      DEVIATION FROM THE CARD: the card says "owner SELECT only", but the app
--      adds, edits and deletes subscriptions from the client
--      (services/subscriptionService.ts), so SELECT-only would break the app.
--      Instead the FOR ALL policy (granted to PUBLIC) becomes four per-command
--      policies for `authenticated`, each scoped to the owner, with an explicit
--      WITH CHECK on INSERT and UPDATE.
--
--   4. Billing fields on public.profiles (found while checking the above)
--      `authenticated` has UPDATE on every column of its own profile row,
--      including subscription_tier and stripe_customer_id. Both apps' clients
--      only write name / phone / avatar style fields; billing fields are
--      written by the Stripe webhooks with the service role. A trigger now
--      stops anon/authenticated from changing those two columns, and forces
--      them to their defaults on a client-side INSERT. On 2026-11-06 all 34
--      profiles were on 'free', so no existing user is affected.
--
--   5. Table privileges for anon on the two SubTrack tables
--      anon has no auth.uid(), so RLS already gives it nothing; revoking the
--      grants removes the dependency on RLS alone.
--
-- Not changed: the "Service role has full access ..." policies (redundant,
-- since service_role bypasses RLS, but harmless), and VortexCore-only tables.
--
-- Rollback: see supabase/rollbacks/20261107000000_s401_permissions.rollback.sql
-- (restores the exact previous grants and policies).
-- =============================================================================

begin;

-- 1. Feature-flag writer: service role only -----------------------------------
revoke execute on function public.sm_update_feature_flag(character varying, boolean)
  from public, anon, authenticated;
grant execute on function public.sm_update_feature_flag(character varying, boolean)
  to service_role;

-- 2. virtual_cards: owners read, only the service role writes -------------------
drop policy if exists "Users can manage own virtual cards" on public.virtual_cards;
-- Kept as is: "Users can view their own virtual cards" (SELECT, authenticated).

-- 3. sm_subscriptions: owner CRUD, explicit WITH CHECK, authenticated only ------
drop policy if exists "Users can manage own sm_subscriptions" on public.sm_subscriptions;

create policy "sm_subscriptions_owner_select" on public.sm_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "sm_subscriptions_owner_insert" on public.sm_subscriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sm_subscriptions_owner_update" on public.sm_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sm_subscriptions_owner_delete" on public.sm_subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4. profiles: billing fields are written by the billing service only ----------
create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Only client roles are restricted. service_role (the Stripe webhooks) and
  -- direct database sessions keep full control.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.subscription_tier := 'free';
      new.stripe_customer_id := null;
    elsif new.subscription_tier is distinct from old.subscription_tier
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'subscription_tier and stripe_customer_id are managed by billing'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_billing_fields() from public, anon, authenticated;

drop trigger if exists trg_profiles_protect_billing on public.profiles;
create trigger trg_profiles_protect_billing
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing_fields();

-- 5. No direct table access for anon on the SubTrack tables -------------------
revoke all on table public.sm_subscriptions from anon;
revoke all on table public.virtual_cards from anon;

commit;

-- =============================================================================
-- Checks to run after applying (read-only)
-- =============================================================================
-- Function: only postgres and service_role may execute.
--   select proacl from pg_proc where oid = 'public.sm_update_feature_flag(character varying, boolean)'::regprocedure;
-- Policies:
--   select tablename, policyname, cmd, roles from pg_policies
--   where tablename in ('sm_subscriptions', 'virtual_cards') order by 1, 2;
-- Trigger:
--   select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'trg_profiles_protect_billing';
-- In the app: add, edit and delete a subscription; edit your profile name;
-- complete a test-mode checkout and see the plan change (webhook path).
