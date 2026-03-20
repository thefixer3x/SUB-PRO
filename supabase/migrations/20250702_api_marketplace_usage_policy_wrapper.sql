-- Migration: wrap auth.uid() in api_marketplace_usage policy.
-- Replay-safe: skip the ALTER when the relation or policy is absent.

DO $$
BEGIN
  IF to_regclass('public.api_marketplace_usage') IS NULL THEN
    RAISE NOTICE 'Skipping public.api_marketplace_usage policy wrapper because relation is missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_marketplace_usage'
      AND policyname = 'Users can view their own API usage'
  ) THEN
    RAISE NOTICE 'Skipping public.api_marketplace_usage policy wrapper because policy is missing';
    RETURN;
  END IF;

  ALTER POLICY "Users can view their own API usage"
    ON public.api_marketplace_usage
    USING (((SELECT auth.uid()) = user_id));
END $$;
