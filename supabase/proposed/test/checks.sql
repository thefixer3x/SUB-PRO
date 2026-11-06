-- Behaviour checks after applying 2026-11-sm-permissions.sql to fixture.sql.
-- Each check raises an exception on failure; the script ends with 'ALL CHECKS PASSED'.
\set ON_ERROR_STOP on
\set alice '11111111-1111-4111-8111-111111111111'
\set bob   '22222222-2222-4222-8222-222222222222'

-- Seed as the service role (the webhook path).
set role service_role;
insert into public.profiles (id, full_name) values (:'alice', 'Alice'), (:'bob', 'Bob');
insert into public.sm_subscriptions (user_id, name) values (:'bob', 'Bob sub');
insert into public.virtual_cards (user_id, card_id, status) values (:'alice', 'ic_a', 'active');
update public.profiles set subscription_tier = 'pro', stripe_customer_id = 'cus_test' where id = :'alice';
reset role;

-- Act as Alice (signed in).
set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false);

do $$ begin
  -- 1. Feature flags can no longer be toggled by a client role.
  begin
    perform public.sm_update_feature_flag('x', true);
    raise exception 'FAIL 1: authenticated could execute sm_update_feature_flag';
  exception when insufficient_privilege then null; end;

  -- 2. virtual_cards: own row readable, no client inserts or updates.
  if (select count(*) from public.virtual_cards) <> 1 then raise exception 'FAIL 2a: owner cannot read own card'; end if;
  begin
    insert into public.virtual_cards (user_id, card_id, status) values (auth.uid(), 'ic_fake', 'active');
    raise exception 'FAIL 2b: client could insert a card row';
  exception when insufficient_privilege then null; end;
  update public.virtual_cards set status = 'canceled';
  if (select status from public.virtual_cards) <> 'active' then raise exception 'FAIL 2c: client could update a card row'; end if;

  -- 3. sm_subscriptions: full CRUD on own rows, nothing on other users' rows.
  insert into public.sm_subscriptions (user_id, name) values (auth.uid(), 'Netflix');
  update public.sm_subscriptions set name = 'Netflix HD' where name = 'Netflix';
  if (select name from public.sm_subscriptions where user_id = auth.uid()) <> 'Netflix HD' then raise exception 'FAIL 3a: owner update'; end if;
  delete from public.sm_subscriptions where name = 'Netflix HD';
  if (select count(*) from public.sm_subscriptions) <> 0 then raise exception 'FAIL 3b: owner sees other rows or delete failed'; end if;
  begin
    insert into public.sm_subscriptions (user_id, name) values ('22222222-2222-4222-8222-222222222222', 'planted');
    raise exception 'FAIL 3c: could insert a row for another user';
  exception when insufficient_privilege then null; end;

  -- 4. profiles: name edits work, billing fields are refused.
  update public.profiles set full_name = 'Alice A' where id = auth.uid();
  if (select full_name from public.profiles where id = auth.uid()) <> 'Alice A' then raise exception 'FAIL 4a: profile edit'; end if;
  begin
    update public.profiles set subscription_tier = 'team' where id = auth.uid();
    raise exception 'FAIL 4b: client changed subscription_tier';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set stripe_customer_id = null where id = auth.uid();
    raise exception 'FAIL 4c: client changed stripe_customer_id';
  exception when insufficient_privilege then null; end;
  -- Saving the same values again (what a full-form save does) is allowed.
  update public.profiles set subscription_tier = 'pro', full_name = 'Alice B' where id = auth.uid();
end $$;

-- 4d. A client-side profile INSERT gets the default billing values.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
insert into public.profiles (id, full_name, subscription_tier, stripe_customer_id)
  values ('33333333-3333-4333-8333-333333333333', 'Carol', 'team', 'cus_x');
reset role;
do $$ begin
  if (select subscription_tier from public.profiles where id = '33333333-3333-4333-8333-333333333333') <> 'free'
     or (select stripe_customer_id from public.profiles where id = '33333333-3333-4333-8333-333333333333') is not null
  then raise exception 'FAIL 4d: client insert kept billing values'; end if;
end $$;

-- 5. anon has no table access.
set role anon;
do $$ begin
  begin
    perform 1 from public.sm_subscriptions;
    raise exception 'FAIL 5: anon could read sm_subscriptions';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 6. The service role (webhooks) still changes billing fields and flags.
set role service_role;
update public.profiles set subscription_tier = 'team' where id = :'alice';
select public.sm_update_feature_flag('x', true);
reset role;
do $$ begin
  if (select subscription_tier from public.profiles where id = '11111111-1111-4111-8111-111111111111') <> 'team'
  then raise exception 'FAIL 6: service role could not change the tier'; end if;
end $$;

select 'ALL CHECKS PASSED' as result;
