\set ON_ERROR_STOP on

set role service_role;
insert into public.sm_envelopes (user_id, name, monthly_amount_minor, currency, category_filter)
values
  ('11111111-1111-4111-8111-111111111111', 'Alice Streaming', 3000, 'USD', 'streaming'),
  ('22222222-2222-4222-8222-222222222222', 'Bob Streaming', 5000, 'USD', 'streaming');
insert into public.sm_insights (user_id, type, payload, explanation, dedupe_key)
values
  ('11111111-1111-4111-8111-111111111111', 'unused_before_renewal', '{}', 'Alice insight', 'alice'),
  ('22222222-2222-4222-8222-222222222222', 'unused_before_renewal', '{}', 'Bob insight', 'bob');
insert into public.sm_envelope_spend (envelope_id, amount_minor, currency, transaction_date, month)
select id, 1000, 'USD', now(), to_char(now() at time zone 'utc', 'YYYY-MM')
  from public.sm_envelopes where user_id = '11111111-1111-4111-8111-111111111111';
reset role;

do $$ begin
  if has_table_privilege('anon', 'public.sm_envelopes', 'SELECT')
     or has_table_privilege('anon', 'public.sm_insights', 'SELECT')
     or has_table_privilege('anon', 'public.sm_ai_consent', 'SELECT') then
    raise exception 'anon can access a P1 table';
  end if;
  if has_table_privilege('authenticated', 'public.sm_envelopes', 'INSERT')
     or has_table_privilege('authenticated', 'public.sm_insights', 'UPDATE')
     or has_table_privilege('authenticated', 'public.sm_ai_consent', 'INSERT') then
    raise exception 'authenticated can directly write a service-managed P1 table';
  end if;
  if not has_table_privilege('authenticated', 'public.sm_envelopes', 'SELECT')
     or not has_table_privilege('service_role', 'public.sm_envelope_spend', 'INSERT') then
    raise exception 'expected P1 table grants are missing';
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'card_authorizations'
         and column_name = 'livemode') not like '%true%' then
    raise exception 'unknown authorization rows must default to live mode';
  end if;
  if (select livemode from public.card_authorizations where stripe_authorization_id = 'ia_legacy') is not true then
    raise exception 'legacy authorization row was not backfilled as live';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$ begin
  if (select count(*) from public.sm_envelopes) <> 1 then raise exception 'envelope owner RLS failed'; end if;
  if (select count(*) from public.sm_insights) <> 1 then raise exception 'insight owner RLS failed'; end if;
  if (select count(*) from public.sm_envelope_spend) <> 1 then raise exception 'envelope spend owner RLS failed'; end if;
  begin
    insert into public.sm_envelopes (user_id, name, monthly_amount_minor)
    values (auth.uid(), 'Direct client insert', 1000);
    raise exception 'client could directly insert an envelope';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'P1 RLS CHECKS PASSED';
