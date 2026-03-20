-- Migration: wrap auth.* calls in RLS policies to avoid per-row re-evaluation.
-- This version is replay-safe: it skips missing relations and missing policies
-- instead of aborting fresh environments during `supabase db reset`.

DO $$
DECLARE
  policy_change RECORD;
BEGIN
  FOR policy_change IN
    SELECT *
    FROM (
      VALUES
        ('public', 'api_marketplace_products', 'Developers can manage their own products', 'USING (((SELECT auth.uid()) = developer_id))'),
        ('public', 'autonomous_agent_runs', 'Users can view their own agent runs', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'expert_marketplace_profiles', 'Experts can manage their own profile', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'expert_sessions', 'Session participants can view sessions', 'USING (((EXISTS (SELECT 1 FROM expert_marketplace_profiles WHERE expert_marketplace_profiles.id = expert_sessions.expert_id AND expert_marketplace_profiles.user_id = (SELECT auth.uid()))) OR ((SELECT auth.uid()) = client_id)))'),
        ('public', 'intelligence_cache', 'Users can view their own cache', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'intelligence_usage_logs', 'Users can view their own intelligence usage', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'knowledge_gaps', 'Users can manage their own knowledge gaps', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'offline_sync_queue', 'Users can manage their own offline sync', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'predictive_memory_suggestions', 'Users can view their own predictions', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'privacy_processing_logs', 'Users can view their own privacy logs', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'screenshot_memories', 'Users can manage screenshot memories for their memories', 'USING ((EXISTS (SELECT 1 FROM memory_entries WHERE memory_entries.id = screenshot_memories.memory_id AND memory_entries.user_id = (SELECT auth.uid()))))'),
        ('public', 'smart_recall_history', 'Users can view their own recall history', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'smart_recall_schedule', 'Users can manage their own recall schedule', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'team_members', 'Team members can view their team', 'USING ((EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = (SELECT auth.uid()))))'),
        ('public', 'team_shared_memories', 'Team members can view shared memories', 'USING ((EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = team_shared_memories.team_id AND team_members.user_id = (SELECT auth.uid()))))'),
        ('public', 'teams', 'Team owners can update teams', 'USING (((SELECT auth.uid()) = owner_id))'),
        ('public', 'teams', 'Teams are readable by members', 'USING ((EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = (SELECT auth.uid()))))'),
        ('public', 'user_config', 'Service role full access to user_config', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'user_config', 'Users can manage own config', 'USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())))'),
        ('public', 'user_subscriptions', 'Users can update their own subscription', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'user_subscriptions', 'Users can view their own subscription', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'voice_memories', 'Users can manage their own voice memories', 'USING (((SELECT auth.uid()) = user_id))'),
        ('public', 'api_keys', 'Service role full access to api_keys', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'api_keys', 'Users can create own API keys', 'WITH CHECK ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'Users can delete own API keys', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'Users can update own API keys', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'Users can view own API keys', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'api_keys_delete_policy', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'api_keys_insert_policy', 'WITH CHECK ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'api_keys_select_policy', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'api_keys', 'api_keys_update_policy', 'USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())))'),
        ('public', 'audit_log', 'Service role full access to audit_log', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'audit_log', 'Users can create audit entries', 'WITH CHECK (((user_id = (SELECT auth.uid())) OR (user_id IS NULL)))'),
        ('public', 'audit_log', 'Users can view own audit logs', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'configurations', 'Admins can manage configs', 'USING ((EXISTS (SELECT 1 FROM api_keys WHERE api_keys.user_id = (SELECT auth.uid()) AND api_keys.access_level = ANY (ARRAY[''admin'',''enterprise'']) AND api_keys.is_active = true)))'),
        ('public', 'configurations', 'Service role full access to configurations', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'configurations', 'Users can view org configs', 'USING (((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))) AND ((is_sensitive = false) OR (is_sensitive IS NULL))))'),
        ('public', 'memory_entries', 'Service role full access to memory_entries', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'memory_entries', 'Users can create memories', 'WITH CHECK (((user_id = (SELECT auth.uid())) AND (organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid())))))'),
        ('public', 'memory_entries', 'Users can delete own memories', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'memory_entries', 'Users can manage own memory entries', 'USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())))'),
        ('public', 'memory_entries', 'Users can update own memories', 'USING ((user_id = (SELECT auth.uid())))'),
        ('public', 'memory_entries', 'Users can view org memories', 'USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))))'),
        ('public', 'projects', 'Admins can delete org projects', 'USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))))'),
        ('public', 'projects', 'Service role full access to projects', 'USING (((SELECT auth.role()) = ''service_role''))'),
        ('public', 'projects', 'Users can create org projects', 'WITH CHECK ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))))'),
        ('public', 'projects', 'Users can update org projects', 'USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))))'),
        ('public', 'projects', 'Users can view org projects', 'USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))))')
    ) AS policy_changes(schema_name, table_name, policy_name, clause_sql)
  LOOP
    IF to_regclass(format('%I.%I', policy_change.schema_name, policy_change.table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping %.% policy % because relation is missing',
        policy_change.schema_name,
        policy_change.table_name,
        policy_change.policy_name;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = policy_change.schema_name
        AND tablename = policy_change.table_name
        AND policyname = policy_change.policy_name
    ) THEN
      RAISE NOTICE 'Skipping %.% policy % because policy is missing',
        policy_change.schema_name,
        policy_change.table_name,
        policy_change.policy_name;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I %s',
      policy_change.policy_name,
      policy_change.schema_name,
      policy_change.table_name,
      policy_change.clause_sql
    );
  END LOOP;
END $$;
