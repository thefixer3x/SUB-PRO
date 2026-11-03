import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseEnvConfigured } from '@/lib/supabase';
import { FEATURE_FLAGS as HARDCODED_FLAGS } from '@/config/featureFlags';

export type FeatureFlagMap = Record<string, boolean>;

/**
 * Key of the Virtual Cards screen gate.
 *
 * It is the same key the flag carries in `sm_feature_flags`, so the gate can be
 * flipped without a deploy. It defaults to `false` in `config/featureFlags.ts`:
 * the screen must not show card data until the live card list is available
 * end to end (see docs/agents/EXECUTION_PLAN.md, card S103).
 */
export const VIRTUAL_CARDS_FLAG = 'virtualCardsEnabled';

async function fetchFeatureFlags(): Promise<FeatureFlagMap> {
  if (!isSupabaseEnvConfigured) {
    return { ...HARDCODED_FLAGS };
  }

  // sm_feature_flags is readable by signed-in users only (RLS), so skip the
  // request before sign-in instead of triggering a 401 and retry loop.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ...HARDCODED_FLAGS };
  }

  const { data, error } = await supabase
    .from('sm_feature_flags')
    .select('name, enabled');

  if (error) {
    // Re-throw so React Query surfaces the error to callers.
    throw new Error(`Feature flag fetch failed: ${error.message}`);
  }

  if (!data) {
    return { ...HARDCODED_FLAGS };
  }

  // Build map from DB rows, with hardcoded as fallback for missing keys
  const dbFlags: FeatureFlagMap = { ...HARDCODED_FLAGS };
  for (const row of data as Array<{ name: string; enabled: boolean }>) {
    dbFlags[row.name] = row.enabled;
  }

  return dbFlags;
}

/**
 * Feature flags sourced from the `sm_feature_flags` table.
 * Falls back to `config/featureFlags.ts` when Supabase is unavailable.
 *
 * **Important:** The `error` field is exposed so callers can surface
 * fetch failures in observability tooling rather than silently degrading.
 */
export const useSupabaseFeatureFlags = () => {
  const lastSuccessfulFlags = useRef<FeatureFlagMap | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery<FeatureFlagMap, Error>({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 10, // 10 minutes — flags don't change often
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data) {
      lastSuccessfulFlags.current = query.data;
    }
  }, [query.data]);

  const flags: FeatureFlagMap =
    query.data ?? lastSuccessfulFlags.current ?? { ...HARDCODED_FLAGS };

  const isEnabled = (flag: string): boolean => {
    return flags[flag] ?? false;
  };

  return {
    flags,
    isEnabled,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
};

/**
 * Gate for the Virtual Cards screen.
 *
 * It resolves from the same `sm_feature_flags` row as every other flag and
 * falls back to `config/featureFlags.ts`, where it defaults to `false`. A
 * missing row, a failed fetch or a missing Supabase configuration therefore all
 * resolve to "off" — the screen never renders card data it cannot vouch for.
 */
export const useVirtualCardsEnabled = (): { enabled: boolean; isLoading: boolean } => {
  const { isEnabled, isLoading } = useSupabaseFeatureFlags();
  return { enabled: isEnabled(VIRTUAL_CARDS_FLAG), isLoading };
};
