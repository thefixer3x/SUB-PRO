-- =============================================================================
-- Webhook idempotency: database-backed dedup for Stripe event processing.
--
-- The webhook handler inserts (event_id, event_type) before processing.
-- A 23505 duplicate-key error means the event was already handled — return
-- 200 immediately.  If this table is missing, a failed insert returns 500
-- which makes Stripe retry; the retry hits the 23505 path.
-- =============================================================================

create table if not exists public.webhook_event_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null unique,        -- Stripe event id (evt_1abc…)
  event_type    text not null,               -- e.g. issuing_authorization.created
  processed_at  timestamptz not null default now()
);

-- RLS: only service_role can read/write.
alter table public.webhook_event_log enable row level security;

create policy "service_role full access to webhook_event_log"
  on public.webhook_event_log
  for all using (auth.jwt() ->> 'role' = 'service_role');

-- Cleanup function: delete rows older than N days.
-- Stripe keeps events for 30 days; 90 is a safe buffer.
create or replace function public.clean_webhook_event_log(max_age_days int)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
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
