import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseEnvConfigured } from '@/lib/supabase';
import { FEATURE_FLAGS as HARDCODED_FLAGS } from '@/config/featureFlags';

type FeatureFlagMap = Record<string, boolean>;

async function fetchFeatureFlags(): Promise<FeatureFlagMap> {
  if (!isSupabaseEnvConfigured) {
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
  const query = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 10, // 10 minutes — flags don't change often
    refetchOnWindowFocus: false,
  });

  const flags: FeatureFlagMap = query.data ?? { ...HARDCODED_FLAGS };

  const isEnabled = (flag: string): boolean => {
    return (flags as Record<string, boolean>)[flag] ?? false;
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
