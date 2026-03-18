-- Migration: wrap auth.* calls in RLS policies to avoid per-row re-evaluation

-- api_marketplace_products
ALTER POLICY "Developers can manage their own products" ON public.api_marketplace_products USING (((SELECT auth.uid()) = developer_id));

-- autonomous_agent_runs
ALTER POLICY "Users can view their own agent runs" ON public.autonomous_agent_runs USING (((SELECT auth.uid()) = user_id));

-- expert_marketplace_profiles
ALTER POLICY "Experts can manage their own profile" ON public.expert_marketplace_profiles USING (((SELECT auth.uid()) = user_id));

-- expert_sessions
ALTER POLICY "Session participants can view sessions" ON public.expert_sessions USING (((EXISTS (SELECT 1 FROM expert_marketplace_profiles WHERE expert_marketplace_profiles.id = expert_sessions.expert_id AND expert_marketplace_profiles.user_id = (SELECT auth.uid()))) OR ((SELECT auth.uid()) = client_id)));

-- intelligence_cache
ALTER POLICY "Users can view their own cache" ON public.intelligence_cache USING (((SELECT auth.uid()) = user_id));

-- intelligence_usage_logs
ALTER POLICY "Users can view their own intelligence usage" ON public.intelligence_usage_logs USING (((SELECT auth.uid()) = user_id));

-- knowledge_gaps
ALTER POLICY "Users can manage their own knowledge gaps" ON public.knowledge_gaps USING (((SELECT auth.uid()) = user_id));

-- offline_sync_queue
ALTER POLICY "Users can manage their own offline sync" ON public.offline_sync_queue USING (((SELECT auth.uid()) = user_id));

-- predictive_memory_suggestions
ALTER POLICY "Users can view their own predictions" ON public.predictive_memory_suggestions USING (((SELECT auth.uid()) = user_id));

-- privacy_processing_logs
ALTER POLICY "Users can view their own privacy logs" ON public.privacy_processing_logs USING (((SELECT auth.uid()) = user_id));

-- screenshot_memories
ALTER POLICY "Users can manage screenshot memories for their memories" ON public.screenshot_memories USING ((EXISTS (SELECT 1 FROM memory_entries WHERE memory_entries.id = screenshot_memories.memory_id AND memory_entries.user_id = (SELECT auth.uid()))));

-- smart_recall_history
ALTER POLICY "Users can view their own recall history" ON public.smart_recall_history USING (((SELECT auth.uid()) = user_id));

-- smart_recall_schedule
ALTER POLICY "Users can manage their own recall schedule" ON public.smart_recall_schedule USING (((SELECT auth.uid()) = user_id));

-- team_members
ALTER POLICY "Team members can view their team" ON public.team_members USING ((EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = (SELECT auth.uid()))));

-- team_shared_memories
ALTER POLICY "Team members can view shared memories" ON public.team_shared_memories USING ((EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = team_shared_memories.team_id AND team_members.user_id = (SELECT auth.uid()))));

-- teams
ALTER POLICY "Team owners can update teams" ON public.teams USING (((SELECT auth.uid()) = owner_id));
ALTER POLICY "Teams are readable by members" ON public.teams USING ((EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = (SELECT auth.uid()))));

-- user_config
ALTER POLICY "Service role full access to user_config" ON public.user_config USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can manage own config" ON public.user_config USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));

-- user_subscriptions
ALTER POLICY "Users can update their own subscription" ON public.user_subscriptions USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their own subscription" ON public.user_subscriptions USING (((SELECT auth.uid()) = user_id));

-- voice_memories
ALTER POLICY "Users can manage their own voice memories" ON public.voice_memories USING (((SELECT auth.uid()) = user_id));

-- api_keys
ALTER POLICY "Service role full access to api_keys" ON public.api_keys USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can create own API keys" ON public.api_keys WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can delete own API keys" ON public.api_keys USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can update own API keys" ON public.api_keys USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can view own API keys" ON public.api_keys USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "api_keys_delete_policy" ON public.api_keys USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "api_keys_insert_policy" ON public.api_keys WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "api_keys_select_policy" ON public.api_keys USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "api_keys_update_policy" ON public.api_keys USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));

-- audit_log
ALTER POLICY "Service role full access to audit_log" ON public.audit_log USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can create audit entries" ON public.audit_log WITH CHECK (((user_id = (SELECT auth.uid())) OR (user_id IS NULL)));
ALTER POLICY "Users can view own audit logs" ON public.audit_log USING ((user_id = (SELECT auth.uid())));

-- configurations
ALTER POLICY "Admins can manage configs" ON public.configurations USING ((EXISTS (SELECT 1 FROM api_keys WHERE api_keys.user_id = (SELECT auth.uid()) AND api_keys.access_level = ANY (ARRAY['admin','enterprise']) AND api_keys.is_active = true)));
ALTER POLICY "Service role full access to configurations" ON public.configurations USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can view org configs" ON public.configurations USING (((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))) AND ((is_sensitive = false) OR (is_sensitive IS NULL))));

-- memory_entries
ALTER POLICY "Service role full access to memory_entries" ON public.memory_entries USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can create memories" ON public.memory_entries WITH CHECK (((user_id = (SELECT auth.uid())) AND (organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid())))));
ALTER POLICY "Users can delete own memories" ON public.memory_entries USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can manage own memory entries" ON public.memory_entries USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can update own memories" ON public.memory_entries USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can view org memories" ON public.memory_entries USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))));

-- projects
ALTER POLICY "Admins can delete org projects" ON public.projects USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))));
ALTER POLICY "Service role full access to projects" ON public.projects USING (((SELECT auth.role()) = 'service_role'));
ALTER POLICY "Users can create org projects" ON public.projects WITH CHECK ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))));
ALTER POLICY "Users can update org projects" ON public.projects USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))));
ALTER POLICY "Users can view org projects" ON public.projects USING ((organization_id IN (SELECT users.organization_id FROM users WHERE users.id = (SELECT auth.uid()))));
