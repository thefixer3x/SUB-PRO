-- Migration: security hardening and performance cleanup.
-- Replay-safe version: each statement is guarded so environments created from
-- source skip missing external/manual relations instead of aborting.

CREATE SCHEMA IF NOT EXISTS private;

DO $$
BEGIN
  IF to_regclass('public.user_subscriptions') IS NOT NULL
     AND to_regclass('public.subscription_tiers') IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW private.user_quota_status_internal AS
      SELECT
        us.user_id,
        p.email::varchar(255) AS email,
        st.name AS tier_name,
        st.intelligence_quota_monthly AS quota_limit,
        us.intelligence_usage_current AS usage,
        CASE
          WHEN st.intelligence_quota_monthly = -1 THEN 'unlimited'
          WHEN us.intelligence_usage_current >= st.intelligence_quota_monthly THEN 'exhausted'
          WHEN us.intelligence_usage_current::numeric >= (st.intelligence_quota_monthly::numeric * 0.8) THEN 'warning'
          ELSE 'ok'
        END AS status,
        us.quota_resets_at
      FROM user_subscriptions us
      JOIN subscription_tiers st ON st.id = us.tier_id
      LEFT JOIN profiles p ON p.id = us.user_id
      WHERE us.status = 'active'
    $sql$;

    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.user_quota_status
      WITH (security_invoker = true)
      AS
      SELECT user_id, email, tier_name, quota_limit, usage, status, quota_resets_at
      FROM private.user_quota_status_internal
    $sql$;

    REVOKE ALL ON public.user_quota_status FROM PUBLIC;
    GRANT SELECT ON public.user_quota_status TO anon, authenticated, service_role;
  ELSE
    RAISE NOTICE 'Skipping user_quota_status views because billing dependencies are missing';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intelligence_usage_logs') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.intelligence_usage_summary
      WITH (security_invoker = true)
      AS
      SELECT tool_name,
             count(*) AS total_calls,
             count(DISTINCT user_id) AS unique_users,
             sum(openai_tokens_used) AS total_tokens,
             sum(openai_cost_usd) AS total_cost,
             avg(response_time_ms) AS avg_response_time,
             sum(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
             sum(CASE WHEN success THEN 1 ELSE 0 END)::double precision / count(*)::double precision AS success_rate,
             date_trunc('day', created_at) AS day
      FROM intelligence_usage_logs
      GROUP BY tool_name, date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at) DESC, count(*) DESC
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping intelligence_usage_summary view because intelligence_usage_logs is missing';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.subscription_tiers') IS NOT NULL
     AND to_regclass('public.user_subscriptions') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.mrr_projection
      WITH (security_invoker = true)
      AS
      SELECT st.name AS tier_name,
             count(us.id) AS subscribers,
             st.price_monthly_usd,
             count(us.id)::numeric * st.price_monthly_usd AS tier_mrr
      FROM subscription_tiers st
      LEFT JOIN user_subscriptions us ON us.tier_id = st.id AND us.status = 'active'
      GROUP BY st.id, st.name, st.price_monthly_usd
      ORDER BY count(us.id)::numeric * st.price_monthly_usd DESC
    $sql$;

    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.tier_distribution
      WITH (security_invoker = true)
      AS
      SELECT st.name AS tier_name,
             st.display_name,
             st.price_monthly_usd,
             count(us.id) AS subscriber_count,
             sum(us.intelligence_usage_current) AS total_usage,
             avg(us.intelligence_usage_current) AS avg_usage
      FROM subscription_tiers st
      LEFT JOIN user_subscriptions us ON us.tier_id = st.id AND us.status = 'active'
      GROUP BY st.id, st.name, st.display_name, st.price_monthly_usd
      ORDER BY st.price_monthly_usd
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping subscription tier views because billing tables are missing';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('maas.organizations') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.legacy_plan_mapping
      WITH (security_invoker = true)
      AS
      SELECT id AS legacy_org_id,
             name AS org_name,
             plan AS legacy_plan,
             CASE
               WHEN plan = 'enterprise' THEN 'enterprise'
               WHEN plan = 'pro' THEN 'pro'
               ELSE 'free'
             END AS new_tier_name
      FROM maas.organizations o
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping legacy_plan_mapping view because maas.organizations is missing';
  END IF;
END $$;

DO $$
DECLARE
  fn_signature text;
BEGIN
  FOREACH fn_signature IN ARRAY ARRAY[
    'public.check_intelligence_access(uuid,text)',
    'public.clean_expired_cache()',
    'public.count_memories(uuid,uuid,text)',
    'public.get_user_tier_info(uuid)',
    'public.handle_new_user_org()',
    'public.increment_intelligence_usage(uuid)',
    'public.log_intelligence_usage(uuid,text,integer,numeric,integer,boolean,boolean,text)',
    'public.memory_stats(uuid,uuid)',
    'public.reset_intelligence_quota()',
    'public.scheduled_intelligence_maintenance()',
    'public.search_memories(vector,double precision,integer,uuid,uuid,text)',
    'public.update_updated_at_column()'
  ]
  LOOP
    IF to_regprocedure(fn_signature) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public',
        fn_signature
      );
    ELSE
      RAISE NOTICE 'Skipping ALTER FUNCTION % because it is missing', fn_signature;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.intelligence_cost_reference') IS NULL THEN
    RAISE NOTICE 'Skipping intelligence_cost_reference RLS hardening because relation is missing';
    RETURN;
  END IF;

  ALTER TABLE public.intelligence_cost_reference ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Allow read to authenticated'
  ) THEN
    CREATE POLICY "Allow read to authenticated" ON public.intelligence_cost_reference
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Allow read to anon'
  ) THEN
    CREATE POLICY "Allow read to anon" ON public.intelligence_cost_reference
      FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Service role full access to intelligence_cost_reference'
  ) THEN
    CREATE POLICY "Service role full access to intelligence_cost_reference" ON public.intelligence_cost_reference
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
DECLARE
  index_change RECORD;
  index_schema_name text;
  index_table_name text;
BEGIN
  FOR index_change IN
    SELECT *
    FROM (
      VALUES
        ('public.api_marketplace_products', 'api_marketplace_products_developer_id_idx', 'developer_id'),
        ('public.autonomous_agent_runs', 'autonomous_agent_runs_user_id_idx', 'user_id'),
        ('public.knowledge_gaps', 'knowledge_gaps_user_id_idx', 'user_id'),
        ('public.predictive_memory_suggestions', 'predictive_memory_suggestions_user_id_idx', 'user_id'),
        ('public.privacy_processing_logs', 'privacy_processing_logs_user_id_idx', 'user_id'),
        ('public.smart_recall_history', 'smart_recall_history_user_id_idx', 'user_id'),
        ('public.team_shared_memories', 'team_shared_memories_memory_id_idx', 'memory_id'),
        ('public.team_shared_memories', 'team_shared_memories_shared_by_idx', 'shared_by'),
        ('public.teams', 'teams_owner_id_idx', 'owner_id')
    ) AS index_changes(table_name, index_name, column_name)
  LOOP
    IF to_regclass(index_change.table_name) IS NULL THEN
      RAISE NOTICE 'Skipping index % because relation % is missing',
        index_change.index_name,
        index_change.table_name;
      CONTINUE;
    END IF;

    index_schema_name := split_part(index_change.table_name, '.', 1);
    index_table_name := split_part(index_change.table_name, '.', 2);

    IF index_table_name = '' THEN
      index_schema_name := 'public';
      index_table_name := index_change.table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = index_schema_name
        AND table_name = index_table_name
        AND column_name = index_change.column_name
    ) THEN
      RAISE NOTICE 'Skipping index % because column % on % is missing',
        index_change.index_name,
        index_change.column_name,
        index_change.table_name;
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      index_change.index_name,
      index_change.table_name,
      index_change.column_name
    );
  END LOOP;
END $$;
