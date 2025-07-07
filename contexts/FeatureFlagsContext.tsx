import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FEATURE_FLAGS as DEFAULT_FLAGS } from '@/config/featureFlags';

type FeatureFlags = Record<string, boolean>;

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
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    // Simplified: Just use default flags for now
    // TODO: Re-enable Supabase integration later
    setIsLoading(false);
    setError(null);
    setFeatureFlags(DEFAULT_FLAGS);
  };

  useEffect(() => {
    // Initialize with default flags immediately
    setFeatureFlags(DEFAULT_FLAGS);
    setIsLoading(false);
    setError(null);
  }, []);

  const isFeatureEnabled = (feature: string): boolean => {
    return Boolean(featureFlags[feature]);
  };

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
