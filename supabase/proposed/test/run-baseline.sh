#!/usr/bin/env bash
# Integration test for the P0 baseline and webhook claim migrations.
# Usage: PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/proposed/test/run-baseline.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
db="p0_baseline_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
q() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }

q -f "$here/baseline-fixture.sql"
q -f "$repo/supabase/migrations/20261107000000_s401_permissions.sql"
q -f "$repo/supabase/migrations/20261107000001_webhook_idempotency.sql"
q -f "$repo/supabase/migrations/20261107000002_baseline_sm_tables.sql"
q -f "$repo/supabase/migrations/20261107000003_webhook_claim_idempotency.sql"

# Applying the baseline again must not restore client/TRUNCATE access or the
# broad legacy subscription policy that S401 removed.
q -f "$repo/supabase/migrations/20261107000002_baseline_sm_tables.sql"

q <<'SQL'
insert into public.profiles (id, email)
values ('22222222-2222-4222-8222-222222222222', 'bob@example.test');

set role service_role;
insert into public.sm_subscriptions (user_id, name, category, plan_name, monthly_cost, renewal_date, payment_method)
values ('22222222-2222-4222-8222-222222222222', 'Bob sub', 'Other', 'Basic', 1, now(), 'card');
insert into public.sm_payment_records (user_id, stripe_invoice_id, amount, currency, status)
values
  ('11111111-1111-4111-8111-111111111111', 'in_legacy_dup', 100, 'usd', 'succeeded'),
  ('11111111-1111-4111-8111-111111111111', 'in_legacy_dup', 100, 'usd', 'succeeded');
reset role;
SQL

# P1 migrations are present in the stacked P1 branch; keep the runner useful
# from the P0-only branch as well.
if [ -f "$repo/supabase/migrations/20261107000004_envelopes.sql" ]; then
  q -f "$repo/supabase/migrations/20261107000004_envelopes.sql"
  q -f "$repo/supabase/migrations/20261107000005_insights.sql"
  q -f "$here/p1-checks.sql"
fi

q <<'SQL'
do $$ begin
  if has_table_privilege('anon', 'public.sm_subscriptions', 'INSERT')
     or has_table_privilege('anon', 'public.sm_subscriptions', 'SELECT')
     or has_table_privilege('anon', 'public.sm_subscriptions', 'TRUNCATE') then
    raise exception 'baseline reapply restored anon privileges';
  end if;
  if has_table_privilege('authenticated', 'public.sm_subscriptions', 'TRUNCATE') then
    raise exception 'authenticated can truncate subscriptions';
  end if;
  if not has_table_privilege('authenticated', 'public.sm_subscriptions', 'INSERT') then
    raise exception 'authenticated lost owner CRUD privilege';
  end if;
  if has_table_privilege('authenticated', 'public.virtual_cards', 'INSERT')
     or has_table_privilege('authenticated', 'public.virtual_cards', 'UPDATE')
     or has_table_privilege('authenticated', 'public.virtual_cards', 'DELETE')
     or has_table_privilege('authenticated', 'public.virtual_cards', 'TRUNCATE') then
    raise exception 'authenticated can write/truncate virtual cards';
  end if;
  if has_table_privilege('anon', 'public.virtual_cards', 'SELECT') then
    raise exception 'baseline reapply restored anon virtual_cards access';
  end if;
  if (select card_id from public.virtual_cards where stripe_card_id = 'ic_legacy') <> 'ic_legacy' then
    raise exception 'baseline did not backfill virtual_cards.card_id';
  end if;
  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'virtual_cards'
         and column_name = 'stripe_card_id') <> 'YES' then
    raise exception 'baseline did not make legacy stripe_card_id nullable';
  end if;
  -- coalesce: with no default at all, NULL NOT LIKE ... is NULL and the check would pass.
  if coalesce((select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'card_authorizations'
         and column_name = 'livemode'), '') not like '%true%' then
    raise exception 'authorization mode default must fail closed to live';
  end if;
  if (select livemode from public.card_authorizations where stripe_authorization_id = 'ia_legacy') is not true then
    raise exception 'legacy authorization row was not defaulted to live mode';
  end if;
  if (select count(*) from public.sm_payment_records where stripe_invoice_id = 'in_legacy_dup') <> 2 then
    raise exception 'baseline did not preserve duplicate payment history';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
       and tablename = 'sm_subscriptions'
       and policyname = 'Users can manage own sm_subscriptions') > 0 then
    raise exception 'baseline reapply restored broad legacy policy';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if (select count(*) from public.sm_subscriptions) <> 0 then
    raise exception 'owner can see another user subscription';
  end if;
  insert into public.sm_subscriptions
    (user_id, name, category, plan_name, monthly_cost, renewal_date, payment_method)
  values (auth.uid(), 'Alice sub', 'Other', 'Basic', 1, now(), 'card');
  if (select count(*) from public.sm_subscriptions) <> 1 then
    raise exception 'owner cannot create/read own subscription';
  end if;
end $$;
reset role;

-- Exercise claim ownership, stale takeover, token fencing, retry release, and
-- the legacy default (`status` omitted means done) against the actual SQL RPCs.
set role service_role;
do $$
declare
  outcome record;
  first_token uuid;
  second_token uuid;
begin
  select * into outcome from public.claim_webhook_event('evt_fenced', 'test.event');
  if outcome.claim_status <> 'claimed' or outcome.claim_token is null then
    raise exception 'first claim did not acquire a token';
  end if;
  first_token := outcome.claim_token;

  select * into outcome from public.claim_webhook_event('evt_fenced', 'test.event', interval '0 seconds');
  if outcome.claim_status <> 'claimed' or outcome.claim_token is null then
    raise exception 'stale claim was not reclaimed';
  end if;
  second_token := outcome.claim_token;
  if first_token = second_token then raise exception 'stale claim reused its token'; end if;

  if public.release_webhook_event('evt_fenced', first_token) then
    raise exception 'stale attempt released the new owner claim';
  end if;
  if public.mark_webhook_event_done('evt_fenced', first_token) then
    raise exception 'stale attempt completed the new owner claim';
  end if;
  select * into outcome from public.claim_webhook_event('evt_fenced', 'test.event');
  if outcome.claim_status <> 'in_progress' then raise exception 'new owner claim was lost'; end if;
  if not public.mark_webhook_event_done('evt_fenced', second_token) then
    raise exception 'current attempt could not complete';
  end if;
  select * into outcome from public.claim_webhook_event('evt_fenced', 'test.event');
  if outcome.claim_status <> 'duplicate' then raise exception 'completed event was not deduplicated'; end if;

  select * into outcome from public.claim_webhook_event('evt_retry', 'test.event');
  if not public.release_webhook_event('evt_retry', outcome.claim_token) then
    raise exception 'current attempt could not release after failure';
  end if;
  select * into outcome from public.claim_webhook_event('evt_retry', 'test.event');
  if outcome.claim_status <> 'claimed' then raise exception 'released event could not retry'; end if;
  if not public.mark_webhook_event_done('evt_retry', outcome.claim_token) then
    raise exception 'retry attempt could not complete';
  end if;

  insert into public.webhook_event_log (event_id, event_type)
  values ('evt_legacy', 'test.event');
  select * into outcome from public.claim_webhook_event('evt_legacy', 'test.event');
  if outcome.claim_status <> 'duplicate' then raise exception 'legacy insert was not treated as done'; end if;
end $$;

do $$
declare
  sync record;
  first_generation bigint;
  current_generation bigint;
  outcome text;
begin
  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  if sync.sync_status <> 'claimed' or not sync.needs_sync then
    raise exception 'first billing sync was not initialized';
  end if;
  first_generation := sync.generation;

  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  current_generation := sync.generation;
  if current_generation <= first_generation then raise exception 'billing generation did not advance'; end if;

  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', first_generation,
    'sub_old_attempt', 1000, 'evt_old_attempt', 'free'
  );
  if outcome <> 'superseded' then raise exception 'old concurrent billing sync was not fenced as superseded'; end if;

  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', current_generation,
    'sub_new', 2000, 'evt_new', 'team'
  );
  if outcome <> 'applied' then raise exception 'new subscription event was not applied'; end if;

  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', sync.generation,
    'sub_old', 1000, 'evt_old', 'free'
  );
  if outcome <> 'stale' then raise exception 'older subscription replaced newer subscription'; end if;

  if (select subscription_tier from public.profiles
       where id = '11111111-1111-4111-8111-111111111111') <> 'team' then
    raise exception 'stale billing event changed profile tier';
  end if;

  -- An older generation can carry the newer subscription: it must be retried
  -- (superseded), and the retry under a fresh generation must win.
  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  first_generation := sync.generation;
  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  current_generation := sync.generation;
  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', current_generation,
    'sub_mid', 2500, 'evt_mid', 'pro'
  );
  if outcome <> 'applied' then raise exception 'newer generation with older subscription was not applied'; end if;
  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', first_generation,
    'sub_latest', 3000, 'evt_latest', 'team'
  );
  if outcome <> 'superseded' then raise exception 'older generation was not reported as superseded'; end if;
  select * into sync from public.begin_subscription_tier_sync('11111111-1111-4111-8111-111111111111');
  outcome := public.apply_subscription_tier_event(
    '11111111-1111-4111-8111-111111111111', sync.generation,
    'sub_latest', 3000, 'evt_latest', 'team'
  );
  if outcome <> 'applied' then raise exception 'retried superseded event did not apply the newer subscription'; end if;
  if (select subscription_tier from public.profiles
       where id = '11111111-1111-4111-8111-111111111111') <> 'team' then
    raise exception 'newer subscription tier was lost';
  end if;

  select * into sync from public.begin_subscription_tier_sync('33333333-3333-4333-8333-333333333333');
  if sync.sync_status <> 'missing_profile' then raise exception 'missing profile was not reported'; end if;
end $$;
reset role;

select 'P0 BASELINE + WEBHOOK RPC CHECKS PASSED';
SQL
