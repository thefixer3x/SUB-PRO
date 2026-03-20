-- Remediate post-merge banking follow-ups on already-migrated environments.
-- 1. Replace the old merchant/amount detection index with detection_key.
-- 2. Add bank_accounts persistence for connected banking accounts.

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN IF NOT EXISTS detection_key TEXT;

    DROP INDEX IF EXISTS public.subscriptions_detection_identity_idx;

    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_detection_key_idx
      ON public.subscriptions (user_id, detection_key)
      WHERE detection_key IS NOT NULL
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping subscriptions detection follow-up because public.subscriptions is missing';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_number TEXT,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_connected BOOLEAN NOT NULL DEFAULT true,
  last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bank_accounts_user_id_idx
  ON public.bank_accounts (user_id);

CREATE INDEX IF NOT EXISTS bank_accounts_connected_idx
  ON public.bank_accounts (user_id, is_connected, last_sync DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_accounts'
      AND policyname = 'Users can manage own bank accounts'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Users can manage own bank accounts" ON public.bank_accounts
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bank_accounts'
      AND policyname = 'Service role has full access to bank accounts'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Service role has full access to bank accounts" ON public.bank_accounts
        FOR ALL
        USING (auth.jwt()->>'role' = 'service_role')
        WITH CHECK (auth.jwt()->>'role' = 'service_role')
    $sql$;
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;

    CREATE TRIGGER update_bank_accounts_updated_at
      BEFORE UPDATE ON public.bank_accounts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  ELSE
    RAISE NOTICE 'Skipping bank_accounts updated_at trigger because update_updated_at_column() is missing';
  END IF;
END $$;
