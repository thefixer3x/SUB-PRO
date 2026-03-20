-- Ensure bank-detected subscriptions can be upserted atomically without
-- collapsing distinct subscriptions from the same merchant.

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE NOTICE 'Skipping detected subscription identity index because public.subscriptions is missing';
    RETURN;
  END IF;

  WITH ranked_subscriptions AS (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY user_id, name, monthly_cost, billing_cycle, category
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS duplicate_rank
    FROM public.subscriptions
  )
  DELETE FROM public.subscriptions AS subscriptions
  USING ranked_subscriptions
  WHERE subscriptions.ctid = ranked_subscriptions.ctid
    AND ranked_subscriptions.duplicate_rank > 1;

  EXECUTE $sql$
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_detection_identity_idx
    ON public.subscriptions (user_id, name, monthly_cost, billing_cycle, category)
  $sql$;
END $$;
