-- =============================================================================
-- Rollback for 2026-11-sm-permissions.sql
-- Restores the grants and policies exactly as read from the live project on
-- 2026-11-06. Runs in one transaction.
-- =============================================================================

begin;

-- 1. Feature-flag writer: previous grants (PUBLIC, anon, authenticated, service_role)
grant execute on function public.sm_update_feature_flag(character varying, boolean)
  to public, anon, authenticated, service_role;

-- 2. virtual_cards: previous owner FOR ALL policy (roles PUBLIC, USING only)
drop policy if exists "Users can manage own virtual cards" on public.virtual_cards;
create policy "Users can manage own virtual cards" on public.virtual_cards
  for all to public
  using (auth.uid() = user_id);

-- 3. sm_subscriptions: previous owner FOR ALL policy
drop policy if exists "sm_subscriptions_owner_select" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_insert" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_update" on public.sm_subscriptions;
drop policy if exists "sm_subscriptions_owner_delete" on public.sm_subscriptions;
drop policy if exists "Users can manage own sm_subscriptions" on public.sm_subscriptions;
create policy "Users can manage own sm_subscriptions" on public.sm_subscriptions
  for all to public
  using (auth.uid() = user_id);

-- 4. profiles: remove the billing-field guard
drop trigger if exists trg_profiles_protect_billing on public.profiles;
drop function if exists public.protect_profile_billing_fields();

-- 5. anon table privileges as before (arwdDxt)
grant select, insert, update, delete, truncate, references, trigger
  on table public.sm_subscriptions to anon;
grant select, insert, update, delete, truncate, references, trigger
  on table public.virtual_cards to anon;

commit;
