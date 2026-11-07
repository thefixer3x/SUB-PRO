-- =============================================================================
-- P1 / F5-F7: insights and AI-insight consent.
--
-- `sm_insights` holds the Plan-inbox rows. The deterministic insight engine
-- writes them with the service role; users read their own rows and change
-- status through the API (accept is a Pro action, dismiss is free).
--
-- `sm_ai_consent` is the opt-in required before the engine looks at a user's
-- spending. It is separate from the Pro tier: free users can opt in and see
-- insights; only accept-to-rule is Pro (F7).
--
-- No card numbers, PANs, CVCs or credentials are ever copied into `payload`.
-- `source_event_ids` keeps every explanation checkable against its events.
-- =============================================================================

create table if not exists public.sm_insights (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             text not null check (type in (
                     'price_increase',
                     'new_recurring_merchant',
                     'unused_before_renewal',
                     'duplicate_subscription',
                     'envelope_at_risk'
                   )),
  payload          jsonb not null default '{}'::jsonb,
  explanation      text not null,
  source_event_ids text[] not null default '{}',
  dedupe_key       text not null,
  status           text not null default 'new' check (status in ('new', 'accepted', 'dismissed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sm_insights_dedupe_key_uniq unique (user_id, dedupe_key)
);

create index if not exists sm_insights_user_status_idx
  on public.sm_insights (user_id, status);

create index if not exists sm_insights_user_created_idx
  on public.sm_insights (user_id, created_at desc);

alter table public.sm_insights enable row level security;

drop policy if exists "sm_insights_owner_select" on public.sm_insights;
create policy "sm_insights_owner_select"
  on public.sm_insights
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role has full access to sm_insights" on public.sm_insights;
create policy "Service role has full access to sm_insights"
  on public.sm_insights
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.sm_insights from anon, authenticated;
grant select on table public.sm_insights to authenticated;
grant all on table public.sm_insights to service_role;

-- ---------------------------------------------------------------------------
-- sm_ai_consent: one row per user, opt-in by default off.
-- ---------------------------------------------------------------------------
create table if not exists public.sm_ai_consent (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  enabled         boolean not null default false,
  consent_version text not null default '2026-11',
  consented_at    timestamptz,
  revoked_at      timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.sm_ai_consent enable row level security;

drop policy if exists "sm_ai_consent_owner_select" on public.sm_ai_consent;
create policy "sm_ai_consent_owner_select"
  on public.sm_ai_consent
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Service role has full access to sm_ai_consent" on public.sm_ai_consent;
create policy "Service role has full access to sm_ai_consent"
  on public.sm_ai_consent
  for all
  using (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.sm_ai_consent from anon, authenticated;
grant select on table public.sm_ai_consent to authenticated;
grant all on table public.sm_ai_consent to service_role;
