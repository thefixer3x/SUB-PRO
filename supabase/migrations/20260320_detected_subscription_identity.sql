-- Ensure bank-detected subscriptions can be upserted atomically without
-- deleting legitimate duplicate subscriptions from the same merchant.

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE NOTICE 'Skipping detected subscription key migration because public.subscriptions is missing';
    RETURN;
  END IF;

  ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS detection_key TEXT;

  EXECUTE $sql$
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_detection_key_idx
    ON public.subscriptions (user_id, detection_key)
    WHERE detection_key IS NOT NULL
  $sql$;
END $$;
