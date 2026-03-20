-- Migration: security hardening and performance cleanup
-- Applied via MCP: sets security_invoker on views, pins function search_path,
-- enables RLS on intelligence_cost_reference, and adds FK indexes.
--
-- WARNING: This migration references tables/views that may not exist on a
-- clean database (e.g. user_subscriptions, subscription_tiers in billing
-- schema).  It was applied manually on 2025-07-01 and is kept here for
-- reference.  To make it replayable, guard each statement with IF EXISTS
-- checks or wrap in exception-handling DO blocks.

-- 1) Create private schema for sensitive joins
CREATE SCHEMA IF NOT EXISTS private;

-- 2) Move user_quota_status logic behind a private view to avoid direct auth.users exposure
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
WHERE us.status = 'active';

CREATE OR REPLACE VIEW public.user_quota_status
WITH (security_invoker = true)
AS
SELECT user_id, email, tier_name, quota_limit, usage, status, quota_resets_at
FROM private.user_quota_status_internal;

REVOKE ALL ON public.user_quota_status FROM PUBLIC;
GRANT SELECT ON public.user_quota_status TO anon, authenticated, service_role;

-- 3) Convert SECURITY DEFINER views to SECURITY INVOKER to respect caller policies
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
ORDER BY date_trunc('day', created_at) DESC, count(*) DESC;

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
ORDER BY count(us.id)::numeric * st.price_monthly_usd DESC;

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
FROM maas.organizations o;

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
ORDER BY st.price_monthly_usd;

-- 4) Pin search_path for security-sensitive functions
ALTER FUNCTION public.check_intelligence_access(p_user_id uuid, p_tool_name text) SET search_path = public;
ALTER FUNCTION public.clean_expired_cache() SET search_path = public;
ALTER FUNCTION public.count_memories(filter_organization_id uuid, filter_user_id uuid, filter_type text) SET search_path = public;
ALTER FUNCTION public.get_user_tier_info(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user_org() SET search_path = public;
ALTER FUNCTION public.increment_intelligence_usage(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.log_intelligence_usage(p_user_id uuid, p_tool_name text, p_tokens_used integer, p_cost_usd numeric, p_response_time_ms integer, p_cache_hit boolean, p_success boolean, p_error_message text) SET search_path = public;
ALTER FUNCTION public.memory_stats(filter_organization_id uuid, filter_user_id uuid) SET search_path = public;
ALTER FUNCTION public.reset_intelligence_quota() SET search_path = public;
ALTER FUNCTION public.scheduled_intelligence_maintenance() SET search_path = public;
ALTER FUNCTION public.search_memories(query_embedding vector, match_threshold double precision, match_count integer, filter_organization_id uuid, filter_user_id uuid, filter_type text) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 5) Enable RLS on intelligence_cost_reference with safe policies
ALTER TABLE public.intelligence_cost_reference ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Allow read to authenticated'
  ) THEN
    CREATE POLICY "Allow read to authenticated" ON public.intelligence_cost_reference
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Allow read to anon'
  ) THEN
    CREATE POLICY "Allow read to anon" ON public.intelligence_cost_reference
      FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'intelligence_cost_reference'
      AND policyname = 'Service role full access to intelligence_cost_reference'
  ) THEN
    CREATE POLICY "Service role full access to intelligence_cost_reference" ON public.intelligence_cost_reference
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- 6) Add covering indexes for foreign keys to improve performance
CREATE INDEX IF NOT EXISTS api_marketplace_products_developer_id_idx ON public.api_marketplace_products (developer_id);
CREATE INDEX IF NOT EXISTS autonomous_agent_runs_user_id_idx ON public.autonomous_agent_runs (user_id);
CREATE INDEX IF NOT EXISTS knowledge_gaps_user_id_idx ON public.knowledge_gaps (user_id);
CREATE INDEX IF NOT EXISTS predictive_memory_suggestions_user_id_idx ON public.predictive_memory_suggestions (user_id);
CREATE INDEX IF NOT EXISTS privacy_processing_logs_user_id_idx ON public.privacy_processing_logs (user_id);
CREATE INDEX IF NOT EXISTS smart_recall_history_user_id_idx ON public.smart_recall_history (user_id);
CREATE INDEX IF NOT EXISTS team_shared_memories_memory_id_idx ON public.team_shared_memories (memory_id);
CREATE INDEX IF NOT EXISTS team_shared_memories_shared_by_idx ON public.team_shared_memories (shared_by);
CREATE INDEX IF NOT EXISTS teams_owner_id_idx ON public.teams (owner_id);
