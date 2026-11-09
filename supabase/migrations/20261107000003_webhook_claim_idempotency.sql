-- =============================================================================
-- Forward upgrade for webhook idempotency.
--
-- 20261107000001 was already applied in existing projects with insert-first
-- semantics. Do not edit that version to add RPCs: `supabase db push` skips a
-- version already recorded in the remote migration ledger. This migration
-- upgrades the shipped table and installs claim -> effect -> complete RPCs.
-- Legacy rows default to done so they are never replayed accidentally.
-- =============================================================================

begin;

alter table public.webhook_event_log
  add column if not exists status text not null default 'done',
  add column if not exists attempts integer not null default 0,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists claim_token uuid;

alter table public.webhook_event_log
  alter column status set default 'done';

do $do$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.webhook_event_log'::regclass
       and conname = 'webhook_event_log_status_check'
  ) then
    alter table public.webhook_event_log
      add constraint webhook_event_log_status_check
      check (status in ('processing', 'done'));
  end if;
end
$do$;

create index if not exists webhook_event_log_status_updated_idx
  on public.webhook_event_log (status, updated_at);

alter table public.webhook_event_log enable row level security;

drop policy if exists "service_role full access to webhook_event_log"
  on public.webhook_event_log;
create policy "service_role full access to webhook_event_log"
  on public.webhook_event_log
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.webhook_event_log from public, anon, authenticated;
grant all on table public.webhook_event_log to service_role;

-- Returns one row:
--   claimed      + fresh claim_token: caller owns the effect
--   duplicate    + null: event was already completed (acknowledge 200)
--   in_progress  + null: another current attempt owns the event (return 500)
create or replace function public.claim_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stale_after interval default interval '10 minutes'
)
returns table (claim_status text, claim_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_status text;
  v_updated timestamptz;
  v_token uuid;
begin
  -- A release can race with the conflicting insert. Retry briefly, but never
  -- run an effect unless the caller owns a row token.
  for attempt in 1..3 loop
    insert into public.webhook_event_log
      (event_id, event_type, status, attempts, updated_at, claim_token)
    values
      (p_event_id, p_event_type, 'processing', 1, now(), gen_random_uuid())
    on conflict (event_id) do nothing
    returning webhook_event_log.claim_token into v_token;

    if found then
      return query select 'claimed'::text, v_token;
      return;
    end if;

    select log.status, log.updated_at, log.claim_token
      into v_status, v_updated, v_token
      from public.webhook_event_log as log
     where log.event_id = p_event_id
       for update;

    if not found then
      continue;
    end if;

    if v_status = 'done' then
      return query select 'duplicate'::text, null::uuid;
      return;
    end if;

    if v_updated > now() - p_stale_after then
      return query select 'in_progress'::text, null::uuid;
      return;
    end if;

    update public.webhook_event_log as log
       set status = 'processing',
           attempts = log.attempts + 1,
           updated_at = now(),
           processed_at = now(),
           claim_token = gen_random_uuid()
     where log.event_id = p_event_id
     returning log.claim_token into v_token;

    if found then
      return query select 'claimed'::text, v_token;
      return;
    end if;
  end loop;

  raise exception 'could not claim webhook event % after 3 attempts', p_event_id;
end;
$function$;

-- Fencing: a stale invocation cannot mark a newer attempt done.
create or replace function public.mark_webhook_event_done(
  p_event_id text,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $function$
  with updated as (
    update public.webhook_event_log
       set status = 'done',
           processed_at = now(),
           updated_at = now(),
           claim_token = null
     where event_id = p_event_id
       and status = 'processing'
       and claim_token = p_claim_token
     returning 1
  )
  select exists (select 1 from updated);
$function$;

-- Fencing: a stale invocation cannot release a newer attempt's claim.
create or replace function public.release_webhook_event(
  p_event_id text,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $function$
  with deleted as (
    delete from public.webhook_event_log
     where event_id = p_event_id
       and status = 'processing'
       and claim_token = p_claim_token
     returning 1
  )
  select exists (select 1 from deleted);
$function$;

-- Serialize billing syncs per user. Each worker receives a generation before
-- it retrieves current Stripe state; only the latest generation may write.
-- The subscription-created timestamp prevents an old subscription from
-- replacing a newer one. Event IDs are stored for audit, not ordered.
create table if not exists public.sm_billing_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  generation bigint not null default 0,
  stripe_subscription_id text,
  subscription_created bigint,
  event_id text,
  subscription_tier text check (subscription_tier in ('free', 'pro', 'team')),
  updated_at timestamptz not null default now()
);

alter table public.sm_billing_state enable row level security;
revoke all on table public.sm_billing_state from public, anon, authenticated;
grant all on table public.sm_billing_state to service_role;

create or replace function public.begin_subscription_tier_sync(p_user_id uuid)
returns table(sync_status text, generation bigint, needs_sync boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_generation bigint;
  v_subscription_id text;
begin
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return query select 'missing_profile'::text, null::bigint, false;
    return;
  end if;

  select state.generation, state.stripe_subscription_id
    into v_generation, v_subscription_id
    from public.sm_billing_state as state
   where state.user_id = p_user_id
     for update;

  if found then
    update public.sm_billing_state as state
       set generation = state.generation + 1,
           updated_at = now()
     where state.user_id = p_user_id
     returning state.generation into v_generation;
    return query select 'claimed'::text, v_generation, v_subscription_id is null;
    return;
  end if;

  begin
    insert into public.sm_billing_state (user_id, generation, updated_at)
    values (p_user_id, 1, now());
    return query select 'claimed'::text, 1::bigint, true;
    return;
  exception when unique_violation then
    -- Another first-sync inserted the row after our initial lookup.
    update public.sm_billing_state as state
       set generation = state.generation + 1,
           updated_at = now()
     where state.user_id = p_user_id
     returning state.generation, state.stripe_subscription_id
          into v_generation, v_subscription_id;
    return query select 'claimed'::text, v_generation, v_subscription_id is null;
    return;
  end;
end;
$function$;

create or replace function public.apply_subscription_tier_event(
  p_user_id uuid,
  p_generation bigint,
  p_subscription_id text,
  p_subscription_created bigint,
  p_event_id text,
  p_tier text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_applied_user_id uuid;
  v_existing_created bigint;
  v_existing_subscription_id text;
begin
  if p_tier not in ('free', 'pro', 'team') then
    raise exception 'invalid subscription tier %', p_tier using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    return 'missing_profile';
  end if;

  select state.subscription_created, state.stripe_subscription_id
    into v_existing_created, v_existing_subscription_id
    from public.sm_billing_state as state
   where state.user_id = p_user_id
     and state.generation = p_generation
     for update;

  -- A newer sync for this user has started. This attempt may still carry the
  -- newer subscription, so it is retried rather than dropped.
  if not found then
    return 'superseded';
  end if;

  if v_existing_created is not null
     and p_subscription_created < v_existing_created then
    return 'stale';
  end if;

  if v_existing_created = p_subscription_created
     and v_existing_subscription_id is not null
     and v_existing_subscription_id <> p_subscription_id
     and p_subscription_id < v_existing_subscription_id then
    return 'stale';
  end if;

  update public.sm_billing_state
     set stripe_subscription_id = p_subscription_id,
         subscription_created = p_subscription_created,
         event_id = p_event_id,
         subscription_tier = p_tier,
         updated_at = now()
   where user_id = p_user_id
     and generation = p_generation
   returning user_id into v_applied_user_id;

  if not found then
    return 'superseded';
  end if;

  update public.profiles
     set subscription_tier = p_tier,
         updated_at = now()
   where id = v_applied_user_id;

  if not found then
    raise exception 'profile % disappeared while applying billing event', p_user_id
      using errcode = '23503';
  end if;

  return 'applied';
end;
$function$;

revoke execute on function public.begin_subscription_tier_sync(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_subscription_tier_sync(uuid)
  to service_role;

revoke execute on function public.apply_subscription_tier_event(uuid, bigint, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_tier_event(uuid, bigint, text, bigint, text, text)
  to service_role;

revoke execute on function public.claim_webhook_event(text, text, interval)
  from public, anon, authenticated;
revoke execute on function public.mark_webhook_event_done(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.release_webhook_event(text, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_webhook_event(text, text, interval)
  to service_role;
grant execute on function public.mark_webhook_event_done(text, uuid)
  to service_role;
grant execute on function public.release_webhook_event(text, uuid)
  to service_role;

commit;
