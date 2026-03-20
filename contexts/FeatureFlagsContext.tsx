import React, { createContext, useContext, ReactNode } from 'react';
import { FEATURE_FLAGS as DEFAULT_FLAGS } from '@/config/featureFlags';
import { useSupabaseFeatureFlags, type FeatureFlagMap } from '@/hooks/useFeatureFlags';

type FeatureFlags = FeatureFlagMap;

interface FeatureFlagsContextType {
  featureFlags: FeatureFlags;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isFeatureEnabled: (feature: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  featureFlags: DEFAULT_FLAGS,
  isLoading: false,
  error: null,
  refresh: async () => {},
  isFeatureEnabled: () => false,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const {
    flags,
    isEnabled,
    isLoading,
    error,
    refetch,
  } = useSupabaseFeatureFlags();

  const refresh = async () => {
    await refetch();
  };
  const featureFlags = flags;
  const isFeatureEnabled = (feature: string): boolean =>
    isEnabled(feature);

  return (
    <FeatureFlagsContext.Provider
      value={{
        featureFlags,
        isLoading,
        error,
        refresh,
        isFeatureEnabled,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
};
