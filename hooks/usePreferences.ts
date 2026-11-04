import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  notifications: {
    renewals: boolean;
    newSubscriptions: boolean;
    weeklyReports: boolean;
  };
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  currency: 'USD',
  notifications: {
    renewals: true,
    newSubscriptions: true,
    weeklyReports: true,
  },
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
        if (stored && mounted) {
          const parsed = JSON.parse(stored) as Partial<UserPreferences>;
          setPreferences(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-persist whenever preferences change (after initial load completes)
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
        .catch(err => console.error('Failed to persist preferences:', err));
    }
  }, [preferences, isLoading]);

  return {
    preferences,
    setPreferences,
    isLoading,
  };
};

const PREFERENCES_KEY = '@subtrack_preferences';

export { DEFAULT_PREFERENCES };
