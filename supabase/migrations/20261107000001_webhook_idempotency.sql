-- =============================================================================
-- Webhook idempotency: database-backed dedup for Stripe event processing.
--
-- Design: claim -> run the effect -> mark done.
--
--   * `claim_webhook_event` inserts `processing` for a new event, returns
--     `duplicate` for a finished event, and takes over a `processing` row only
--     when it is older than the stale window (a crashed invocation).
--   * `mark_webhook_event_done` runs only after the effect succeeds.
--   * `release_webhook_event` deletes an unfinished claim so Stripe's retry can
--     process it again.
--
-- This replaces the previous "log first, then work" design, which marked an
-- event as handled even when the write it guarded had failed.
--
-- The table is idempotent to re-apply: it was shipped once as a plain
-- (event_id, event_type, processed_at) table, so every new column is added with
-- `if not exists` and old rows are backfilled as `done` to preserve the
-- previous behaviour for events that were already logged.
-- =============================================================================

create table if not exists public.webhook_event_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null unique,        -- Stripe event id (evt_1abc…)
  event_type    text not null,               -- e.g. issuing_authorization.created
  processed_at  timestamptz not null default now()
);

alter table public.webhook_event_log
  add column if not exists processed_at timestamptz not null default now();

-- Only the first apply needs this: rows written by the previous design were
-- logged before the effect ran, so we cannot know whether they succeeded.
-- Treat them as done rather than replaying them (a replay could duplicate
-- effects). On re-apply the columns already exist and no row is touched.
do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'webhook_event_log'
       and column_name = 'status'
  ) then
    alter table public.webhook_event_log
      add column status     text not null default 'processing',
      add column attempts   integer not null default 1,
      add column updated_at timestamptz not null default now();

    update public.webhook_event_log set status = 'done';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'webhook_event_log_status_check'
  ) then
    alter table public.webhook_event_log
      add constraint webhook_event_log_status_check
      check (status in ('processing', 'done'));
  end if;
end $$;

create index if not exists webhook_event_log_status_updated_idx
  on public.webhook_event_log (status, updated_at);

-- RLS: only the service role reads or writes this table.
alter table public.webhook_event_log enable row level security;

drop policy if exists "service_role full access to webhook_event_log"
  on public.webhook_event_log;
create policy "service_role full access to webhook_event_log"
  on public.webhook_event_log
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.webhook_event_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- claim_webhook_event
--
-- Returns:
--   'claimed'     -> caller owns the event and must run the effect
--   'duplicate'   -> event already finished; return 200 and skip
--   'in_progress' -> another invocation is still working; return 200 and skip
--
-- `p_stale_after` is how long a `processing` row may sit before it is treated
-- as crashed and reclaimed. Keep it longer than the slowest expected handler.
-- ---------------------------------------------------------------------------
create or replace function public.claim_webhook_event(
  p_event_id   text,
  p_event_type text,
  p_stale_after interval default interval '10 minutes'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_updated timestamptz;
begin
  -- Three attempts cover the case where another invocation releases its claim
  -- between our conflicting insert and the row lock. If we still cannot
  -- establish ownership, fail closed rather than process without a claim.
  for attempt in 1..3 loop
    insert into public.webhook_event_log (event_id, event_type, status, attempts, updated_at)
    values (p_event_id, p_event_type, 'processing', 1, now())
    on conflict (event_id) do nothing;

    if found then
      return 'claimed';
    end if;

    select status, updated_at
      into v_status, v_updated
      from public.webhook_event_log
     where event_id = p_event_id
       for update;

    if not found then
      continue;
    end if;

    if v_status = 'done' then
      return 'duplicate';
    end if;

    if v_updated > now() - p_stale_after then
      return 'in_progress';
    end if;

    update public.webhook_event_log
       set status = 'processing',
           attempts = attempts + 1,
           updated_at = now(),
           processed_at = now()
     where event_id = p_event_id;

    return 'claimed';
  end loop;

  raise exception 'could not claim webhook event % after 3 attempts', p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_webhook_event_done / release_webhook_event
-- ---------------------------------------------------------------------------
create or replace function public.mark_webhook_event_done(p_event_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.webhook_event_log
     set status = 'done',
         processed_at = now(),
         updated_at = now()
   where event_id = p_event_id;
$$;

create or replace function public.release_webhook_event(p_event_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.webhook_event_log
   where event_id = p_event_id
     and status = 'processing';
$$;

revoke execute on function public.claim_webhook_event(text, text, interval)
  from public, anon, authenticated;
revoke execute on function public.mark_webhook_event_done(text)
  from public, anon, authenticated;
revoke execute on function public.release_webhook_event(text)
  from public, anon, authenticated;

grant execute on function public.claim_webhook_event(text, text, interval)
  to service_role;
grant execute on function public.mark_webhook_event_done(text)
  to service_role;
grant execute on function public.release_webhook_event(text)
  to service_role;

-- Cleanup: delete rows older than N days. Stripe keeps events for 30 days; 90
-- is a safe buffer. Schedule this with pg_cron or a Vercel cron (see
-- docs/implementation/P0_PLAN.md).
create or replace function public.clean_webhook_event_log(max_age_days int)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.webhook_event_log
   where processed_at < now() - (max_age_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.clean_webhook_event_log(int) from public, anon, authenticated;
grant execute on function public.clean_webhook_event_log(int) to service_role;
