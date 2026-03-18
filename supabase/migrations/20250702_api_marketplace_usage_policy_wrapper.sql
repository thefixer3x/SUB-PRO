-- Migration: wrap auth.uid() in api_marketplace_usage policy
ALTER POLICY "Users can view their own API usage" ON public.api_marketplace_usage USING (((SELECT auth.uid()) = user_id));
